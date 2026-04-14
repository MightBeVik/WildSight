"""Prepare a clean YOLO dataset split and train the MegaMod detector."""
from __future__ import annotations

import json
import random
import shutil
from collections import defaultdict
from pathlib import Path

import yaml
from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DATASET = PROJECT_ROOT / "CV_Project.yolov5pytorch"
PREPARED_DATASET = PROJECT_ROOT / "data" / "annotations" / "megamod_yolo"
MODEL_OUTPUT = PROJECT_ROOT / "data" / "models" / "megamod.pt"
REPORT_OUTPUT = PROJECT_ROOT / "outputs" / "evaluation_reports" / "megamod_training_summary.json"
TRAINING_OUTPUT_DIR = PROJECT_ROOT / "outputs" / "evaluation_reports" / "megamod_training"
MEGADETECTOR_WEIGHTS = PROJECT_ROOT / "data" / "models" / "megadetector_v5.pt"
FALLBACK_WEIGHTS = PROJECT_ROOT / "yolov5su.pt"

TRAIN_RATIO = 0.8
VAL_RATIO = 0.1
TEST_RATIO = 0.1
SPLIT_SEED = 42


def _safe_rmtree(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)


def _dominant_class(label_path: Path) -> int:
    content = label_path.read_text(encoding="utf-8").strip().splitlines()
    classes = []
    for line in content:
        if not line.strip():
            continue
        parts = line.split()
        try:
            classes.append(int(parts[0]))
        except (IndexError, ValueError):
            continue

    if not classes:
        return -1

    counts = defaultdict(int)
    for class_id in classes:
        counts[class_id] += 1
    return max(counts, key=counts.get)


def prepare_dataset() -> tuple[Path, dict]:
    train_images = SOURCE_DATASET / "train" / "images"
    train_labels = SOURCE_DATASET / "train" / "labels"
    if not train_images.exists() or not train_labels.exists():
        raise FileNotFoundError("Expected Roboflow YOLO dataset under CV_Project.yolov5pytorch/train")

    image_files = sorted([path for path in train_images.iterdir() if path.is_file()])
    pairs = []
    for image_path in image_files:
        label_path = train_labels / f"{image_path.stem}.txt"
        if not label_path.exists():
            raise FileNotFoundError(f"Missing label for {image_path.name}")
        pairs.append((image_path, label_path, _dominant_class(label_path)))

    buckets: dict[int, list[tuple[Path, Path, int]]] = defaultdict(list)
    for pair in pairs:
        buckets[pair[2]].append(pair)

    randomizer = random.Random(SPLIT_SEED)
    split_members = {"train": [], "valid": [], "test": []}
    per_class_counts = {}

    for class_id, items in buckets.items():
        randomizer.shuffle(items)
        total = len(items)
        train_cutoff = int(total * TRAIN_RATIO)
        val_cutoff = train_cutoff + int(total * VAL_RATIO)

        split_members["train"].extend(items[:train_cutoff])
        split_members["valid"].extend(items[train_cutoff:val_cutoff])
        split_members["test"].extend(items[val_cutoff:])
        per_class_counts[str(class_id)] = {
            "total": total,
            "train": len(items[:train_cutoff]),
            "valid": len(items[train_cutoff:val_cutoff]),
            "test": len(items[val_cutoff:]),
        }

    _safe_rmtree(PREPARED_DATASET)
    for split in ("train", "valid", "test"):
        (PREPARED_DATASET / split / "images").mkdir(parents=True, exist_ok=True)
        (PREPARED_DATASET / split / "labels").mkdir(parents=True, exist_ok=True)

        for image_path, label_path, _ in split_members[split]:
            shutil.copy2(image_path, PREPARED_DATASET / split / "images" / image_path.name)
            shutil.copy2(label_path, PREPARED_DATASET / split / "labels" / label_path.name)

    source_yaml = yaml.safe_load((SOURCE_DATASET / "data.yaml").read_text(encoding="utf-8"))
    prepared_yaml = {
        "path": str(PREPARED_DATASET),
        "train": "train/images",
        "val": "valid/images",
        "test": "test/images",
        "nc": source_yaml["nc"],
        "names": source_yaml["names"],
    }
    prepared_yaml_path = PREPARED_DATASET / "data.yaml"
    prepared_yaml_path.write_text(yaml.safe_dump(prepared_yaml, sort_keys=False), encoding="utf-8")

    split_summary = {
        "total_images": len(pairs),
        "seed": SPLIT_SEED,
        "splits": {key: len(value) for key, value in split_members.items()},
        "per_class_counts": per_class_counts,
        "source_dataset": str(SOURCE_DATASET),
        "prepared_dataset": str(PREPARED_DATASET),
    }

    return prepared_yaml_path, split_summary


def train_megamod() -> dict:
    prepared_yaml_path, split_summary = prepare_dataset()
    _safe_rmtree(TRAINING_OUTPUT_DIR)

    train_source = str(FALLBACK_WEIGHTS)
    if MEGADETECTOR_WEIGHTS.exists():
        try:
            YOLO(str(MEGADETECTOR_WEIGHTS))
            train_source = str(MEGADETECTOR_WEIGHTS)
        except Exception:
            train_source = str(FALLBACK_WEIGHTS)

    model = YOLO(train_source)
    results = model.train(
        data=str(prepared_yaml_path),
        epochs=40,
        imgsz=960,
        batch=8,
        device=0,
        workers=0,
        project=str(PROJECT_ROOT / "outputs" / "evaluation_reports"),
        name="megamod_training",
        exist_ok=True,
        pretrained=True,
        cache=False,
        seed=SPLIT_SEED,
        patience=15,
        verbose=True,
    )

    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    if not best_weights.exists():
        raise FileNotFoundError(f"Training completed but best weights were not found at {best_weights}")

    MODEL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_weights, MODEL_OUTPUT)

    metrics = {
        "precision": float(results.results_dict.get("metrics/precision(B)", 0.0)),
        "recall": float(results.results_dict.get("metrics/recall(B)", 0.0)),
        "map50": float(results.results_dict.get("metrics/mAP50(B)", 0.0)),
        "map50_95": float(results.results_dict.get("metrics/mAP50-95(B)", 0.0)),
    }

    summary = {
        "model_name": "MegaMod",
        "train_source": train_source,
        "dataset_yaml": str(prepared_yaml_path),
        "weights_output": str(MODEL_OUTPUT),
        "save_dir": str(results.save_dir),
        "metrics": metrics,
        "dataset": split_summary,
    }
    REPORT_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_OUTPUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    summary = train_megamod()
    print(json.dumps(summary, indent=2))