"""Video router — upload videos, sample frames, detect animals, and classify species."""
import shutil
import time
from datetime import datetime
from pathlib import Path

import cv2
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.config import (
    CONFIDENCE_THRESHOLD,
    SUPPORTED_VIDEO_EXTENSIONS,
    VIDEO_OUTPUT_DIR,
    VIDEO_UPLOAD_DIR,
)
from app.services.classifier import get_classifier
from app.services.detector import get_detector
from app.services.preprocessor import annotate_image, crop_detection, generate_image_id, load_image, resize_image

router = APIRouter(prefix="/api/videos", tags=["video"])

uploaded_videos: dict = {}
video_results: dict = {}


def _video_metadata(filepath: Path) -> dict:
    capture = cv2.VideoCapture(str(filepath))
    if not capture.isOpened():
        return {"error": "Unable to open video"}

    fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    capture.release()

    duration_seconds = round(frame_count / fps, 2) if fps else 0.0
    return {
        "fps": round(fps, 2),
        "frame_count": frame_count,
        "width": width,
        "height": height,
        "duration_seconds": duration_seconds,
        "size_bytes": filepath.stat().st_size,
    }


@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """Upload a single video for sampled-frame analysis."""
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type: {ext}. Supported: {SUPPORTED_VIDEO_EXTENSIONS}",
        )

    video_id = generate_image_id()
    filename = f"{video_id}{ext}"
    filepath = VIDEO_UPLOAD_DIR / filename

    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {exc}")

    metadata = _video_metadata(filepath)
    if "error" in metadata:
        filepath.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=metadata["error"])

    uploaded_videos[video_id] = {
        "video_id": video_id,
        "filename": file.filename,
        "saved_as": filename,
        "filepath": str(filepath),
        "video_url": f"/uploads/videos/{filename}",
        "upload_time": datetime.now().isoformat(),
        **metadata,
    }
    return uploaded_videos[video_id]


@router.post("/process/{video_id}")
async def process_video(
    video_id: str,
    confidence: float = Query(default=CONFIDENCE_THRESHOLD, ge=0.1, le=1.0),
    sample_seconds: float = Query(default=1.0, ge=0.2, le=10.0),
    models: str = Query(default="all"),
    max_frames: int = Query(default=24, ge=1, le=120),
):
    """Analyze a video by sampling frames at a fixed interval."""
    if video_id not in uploaded_videos:
        raise HTTPException(status_code=404, detail="Video not found")

    info = uploaded_videos[video_id]
    filepath = Path(info["filepath"])
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    detector = get_detector()
    classifier = get_classifier()

    capture = cv2.VideoCapture(str(filepath))
    if not capture.isOpened():
        raise HTTPException(status_code=400, detail="Unable to open video for processing")

    fps = info["fps"] or 1.0
    frame_count = info["frame_count"] or 0
    stride = max(int(round(fps * sample_seconds)), 1)
    sample_indices = list(range(0, max(frame_count, 1), stride))[:max_frames]
    output_dir = VIDEO_OUTPUT_DIR / video_id
    output_dir.mkdir(parents=True, exist_ok=True)

    # Clear previous annotated frames for a fresh run.
    for existing in output_dir.glob("*.jpg"):
        existing.unlink(missing_ok=True)

    start = time.time()
    frames = []
    species_counts = {}
    frames_with_animals = 0

    for sample_number, frame_index in enumerate(sample_indices):
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ok, frame = capture.read()
        if not ok:
            continue

        raw_frame_path = output_dir / f"raw_{sample_number:04d}.jpg"
        cv2.imwrite(str(raw_frame_path), frame)

        detection_bundle = detector.detect_all(str(raw_frame_path), confidence=confidence, detector_keys=models)
        primary_key = detection_bundle["primary_detector"]
        primary_detection = detection_bundle["by_detector"][primary_key]

        pil_image = load_image(raw_frame_path)
        classifications = []
        animal_detections = [det for det in primary_detection["detections"] if det["category"] == "animal"]
        if animal_detections:
            frames_with_animals += 1

        for det_index, det in enumerate(animal_detections):
            crop = crop_detection(pil_image, (det["x1"], det["y1"], det["x2"], det["y2"]), padding=0.1)
            result = classifier.classify(crop)
            result["detection_index"] = det_index
            result["bbox"] = det
            classifications.append(result)
            species = result["species"]
            species_counts[species] = species_counts.get(species, 0) + 1

        annotated = annotate_image(resize_image(pil_image, max_size=1600), primary_detection["detections"], classifications)
        annotated_name = f"frame_{sample_number:04d}.jpg"
        annotated_path = output_dir / annotated_name
        annotated.save(annotated_path, format="JPEG", quality=90, optimize=True)
        raw_frame_path.unlink(missing_ok=True)

        frames.append(
            {
                "frame_number": int(frame_index),
                "sample_number": sample_number + 1,
                "timestamp_seconds": round(frame_index / fps, 2) if fps else 0.0,
                "has_animal": primary_detection["has_animal"],
                "animal_count": len(animal_detections),
                "detections": primary_detection["detections"],
                "classifications": classifications,
                "detector_key": primary_key,
                "detector_label": primary_detection["detector_label"],
                "annotated_frame_url": f"/outputs/video_frames/{video_id}/{annotated_name}",
            }
        )

    capture.release()

    result = {
        "video_id": video_id,
        "filename": info["filename"],
        "video_url": info["video_url"],
        "duration_seconds": info["duration_seconds"],
        "fps": info["fps"],
        "width": info["width"],
        "height": info["height"],
        "frame_count": info["frame_count"],
        "sample_interval_seconds": sample_seconds,
        "sampled_frames": len(frames),
        "frames_with_animals": frames_with_animals,
        "species_counts": species_counts,
        "processing_time_ms": round((time.time() - start) * 1000, 2),
        "frames": frames,
        "timestamp": datetime.now().isoformat(),
    }
    video_results[video_id] = result
    return result


@router.get("")
async def list_videos():
    """List uploaded videos and any processed results."""
    return {
        "videos": list(uploaded_videos.values()),
        "processed": list(video_results.values()),
        "total": len(uploaded_videos),
    }


@router.get("/{video_id}")
async def get_video_result(video_id: str):
    """Get the latest processed result for a specific video."""
    if video_id in video_results:
        return video_results[video_id]
    if video_id in uploaded_videos:
        return uploaded_videos[video_id]
    raise HTTPException(status_code=404, detail="Video not found")


def get_uploaded_videos():
    return uploaded_videos


def get_video_results():
    return video_results