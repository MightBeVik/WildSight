"""Review router — approve detections, capture feedback, and export YOLO datasets."""
import io
import json
import zipfile
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.routers.classify import get_classification_results
from app.routers.detect import get_detection_results
from app.routers.upload import get_uploaded_images

router = APIRouter(prefix="/api", tags=["review"])

review_results: dict = {}


class ReviewUpdate(BaseModel):
    detector_key: str = "primary"
    detection_index: int = Field(ge=0)
    status: Literal["pending", "approved", "rejected"] = "pending"
    corrected_label: Optional[str] = None
    notes: Optional[str] = None
    export_target: Literal["review", "train_model"] = "review"


def _resolve_detector_key(image_id: str, detector_key: str) -> str:
    detections = get_detection_results()
    if image_id not in detections:
        raise HTTPException(status_code=404, detail="Detection results not found for this image")
    if detector_key == "primary":
        return detections[image_id]["primary_detector"]
    return detector_key


def _get_selected_outputs(image_id: str, detector_key: str):
    detections = get_detection_results()
    classifications = get_classification_results()
    images = get_uploaded_images()

    if image_id not in images:
        raise HTTPException(status_code=404, detail="Image not found")
    if image_id not in detections:
        raise HTTPException(status_code=404, detail="Detection results not found for this image")

    selected_key = _resolve_detector_key(image_id, detector_key)
    detection = detections[image_id]["by_detector"].get(selected_key)
    if detection is None:
        raise HTTPException(status_code=404, detail=f"Detector '{selected_key}' not found for this image")

    classification = classifications.get(image_id, {}).get(selected_key)
    animal_detections = [det for det in detection["detections"] if det["category"] == "animal"]
    return images[image_id], selected_key, detection, classification, animal_detections


def _serialize_reviews(image_id: str, detector_key: str):
    image_info, selected_key, detection, classification, animal_detections = _get_selected_outputs(image_id, detector_key)
    image_reviews = review_results.get(image_id, {}).get(selected_key, {})
    predicted = classification["classifications"] if classification else []

    reviews = []
    for index, det in enumerate(animal_detections):
        stored = image_reviews.get(index, {})
        predicted_label = predicted[index]["species"] if index < len(predicted) else "Animal"
        predicted_confidence = predicted[index]["confidence"] if index < len(predicted) else det["confidence"]
        reviews.append(
            {
                "detection_index": index,
                "status": stored.get("status", "pending"),
                "corrected_label": stored.get("corrected_label"),
                "notes": stored.get("notes"),
                "export_target": stored.get("export_target", "review"),
                "predicted_label": predicted_label,
                "predicted_confidence": predicted_confidence,
                "bbox": det,
            }
        )

    summary = {
        "approved": sum(1 for item in reviews if item["status"] == "approved"),
        "rejected": sum(1 for item in reviews if item["status"] == "rejected"),
        "pending": sum(1 for item in reviews if item["status"] == "pending"),
        "total": len(reviews),
    }

    return {
        "image_id": image_id,
        "filename": image_info["filename"],
        "detector_key": selected_key,
        "detector_label": detection["detector_label"],
        "has_animal": detection["has_animal"],
        "reviews": reviews,
        "summary": summary,
    }


def _assign_split(position: int, total: int) -> str:
    if total < 5:
        return "train"

    ratio = (position + 1) / total
    if ratio <= 0.8:
        return "train"
    if ratio <= 0.9:
        return "val"
    return "test"


def _to_yolo_line(bbox: dict, class_id: int) -> str:
    x_center = (bbox["x1"] + bbox["x2"]) / 2
    y_center = (bbox["y1"] + bbox["y2"]) / 2
    width = bbox["x2"] - bbox["x1"]
    height = bbox["y2"] - bbox["y1"]
    return f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}"


@router.get("/reviews/{image_id}")
async def get_reviews(image_id: str, detector_key: str = Query(default="primary")):
    """Get review state for one image and detector."""
    return _serialize_reviews(image_id, detector_key)


@router.put("/reviews/{image_id}")
async def update_review(image_id: str, payload: ReviewUpdate):
    """Approve, reject, or correct a detection/classification result."""
    _, selected_key, _, _, animal_detections = _get_selected_outputs(image_id, payload.detector_key)

    if payload.detection_index >= len(animal_detections):
        raise HTTPException(status_code=404, detail="Detection index out of range")

    image_reviews = review_results.setdefault(image_id, {})
    detector_reviews = image_reviews.setdefault(selected_key, {})
    cleaned_label = (payload.corrected_label or "").strip() or None
    cleaned_notes = (payload.notes or "").strip() or None

    detector_reviews[payload.detection_index] = {
        "status": payload.status,
        "corrected_label": cleaned_label if payload.export_target == "train_model" else None,
        "notes": cleaned_notes,
        "export_target": payload.export_target,
    }

    return {
        "message": "Review saved",
        "review": detector_reviews[payload.detection_index],
        "state": _serialize_reviews(image_id, selected_key),
    }


@router.get("/exports/yolo-detections")
async def export_yolo_detections(
    detector_key: str = Query(default="primary"),
    export_target: Literal["review", "train_model"] = Query(default="review"),
    approved_only: bool = Query(default=False),
):
    """Export detections as a YOLO-format dataset ZIP."""
    images = get_uploaded_images()
    detections = get_detection_results()
    classifications = get_classification_results()

    if not detections:
        raise HTTPException(status_code=404, detail="No detection results available for YOLO export")

    class_to_id = {}
    dataset_items = []

    for image_id in sorted(detections.keys()):
        image_info = images.get(image_id)
        if image_info is None:
            continue

        selected_key = _resolve_detector_key(image_id, detector_key)
        detection = detections[image_id]["by_detector"].get(selected_key)
        if detection is None:
            continue

        animal_detections = [det for det in detection["detections"] if det["category"] == "animal"]
        class_predictions = classifications.get(image_id, {}).get(selected_key, {}).get("classifications", [])
        detector_reviews = review_results.get(image_id, {}).get(selected_key, {})

        label_lines = []
        review_manifest = []
        has_review_decision = False

        for index, det in enumerate(animal_detections):
            stored = detector_reviews.get(index, {})
            status = stored.get("status", "pending")
            predicted_label = class_predictions[index]["species"] if index < len(class_predictions) else "Animal"
            corrected_label = stored.get("corrected_label") or predicted_label

            if status in {"approved", "rejected"}:
                has_review_decision = True

            include_detection = True
            if status == "rejected":
                include_detection = False
            elif approved_only and status != "approved":
                include_detection = False
            elif export_target == "train_model" and status != "approved":
                include_detection = False

            if include_detection:
                class_name = corrected_label if export_target == "train_model" else "animal"
                class_id = class_to_id.setdefault(class_name, len(class_to_id))
                label_lines.append(_to_yolo_line(det, class_id))

            review_manifest.append(
                {
                    "detection_index": index,
                    "status": status,
                    "predicted_label": predicted_label,
                    "corrected_label": stored.get("corrected_label"),
                    "included": include_detection,
                    "bbox": det,
                }
            )

        include_image = bool(label_lines)
        if export_target == "review" and not approved_only:
            include_image = True
        elif export_target == "train_model" and not animal_detections:
            include_image = True
        elif export_target == "train_model" and has_review_decision and not label_lines:
            include_image = True

        if not include_image:
            continue

        dataset_items.append(
            {
                "image_id": image_id,
                "filename": image_info["filename"],
                "filepath": image_info["filepath"],
                "labels": label_lines,
                "reviews": review_manifest,
                "detector_key": selected_key,
            }
        )

    if not dataset_items:
        raise HTTPException(
            status_code=404,
            detail=(
                "No detections matched the requested export settings. "
                "Approve detections first if you are exporting a training dataset."
            ),
        )

    if not class_to_id:
        class_to_id = {"animal": 0}

    zip_buffer = io.BytesIO()
    manifest = []

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        total = len(dataset_items)
        for index, item in enumerate(dataset_items):
            split = _assign_split(index, total)
            image_path = Path(item["filepath"])
            image_ext = image_path.suffix or ".jpg"
            stem = Path(item["filename"]).stem or item["image_id"]
            image_archive_name = f"images/{split}/{stem}{image_ext}"
            label_archive_name = f"labels/{split}/{stem}.txt"

            archive.writestr(image_archive_name, image_path.read_bytes())
            archive.writestr(label_archive_name, "\n".join(item["labels"]))
            manifest.append(
                {
                    "image_id": item["image_id"],
                    "filename": item["filename"],
                    "split": split,
                    "detector_key": item["detector_key"],
                    "labels": item["labels"],
                    "reviews": item["reviews"],
                }
            )

        names = {class_id: class_name for class_name, class_id in class_to_id.items()}
        data_yaml = [
            "path: .",
            "train: images/train",
            "val: images/val",
            "test: images/test",
            "names:",
        ]
        for class_id in sorted(names.keys()):
            data_yaml.append(f"  {class_id}: {names[class_id]}")

        archive.writestr("data.yaml", "\n".join(data_yaml) + "\n")
        archive.writestr(
            "manifest.json",
            json.dumps(
                {
                    "export_target": export_target,
                    "approved_only": approved_only,
                    "class_map": class_to_id,
                    "images": manifest,
                },
                indent=2,
            ),
        )

    zip_buffer.seek(0)
    suffix = "training" if export_target == "train_model" else "review"
    headers = {
        "Content-Disposition": f'attachment; filename="wildsight_yolo_{suffix}.zip"',
    }
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)


def get_review_results():
    """Access review results from other modules."""
    return review_results