"""
FastAPI main application — Wildlife Detection & Classification System
eDNA Research Lab, SAIT — Camera Trap Analysis Platform
"""
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGINS, OUTPUTS_DIR, UPLOAD_DIR
from app.routers import upload, detect, classify, review, video

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-25s | %(levelname)-7s | %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Wildlife Detection & Classification API",
    description=(
        "Camera trap image analysis for the eDNA Research Lab at SAIT. "
        "Detects and classifies wildlife species from motion-activated camera images "
        "across Alberta's forests and rural farmlands."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images as static files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")

# Include routers
app.include_router(upload.router)
app.include_router(detect.router)
app.include_router(classify.router)
app.include_router(review.router)
app.include_router(video.router)


@app.get("/")
async def root():
    return {
        "name": "Wildlife Detection & Classification API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "upload": "POST /api/upload",
            "video_upload": "POST /api/videos/upload",
            "detect": "POST /api/detect/{image_id}",
            "classify": "POST /api/classify/{image_id}",
            "video_process": "POST /api/videos/process/{video_id}",
            "export": "GET /api/exports/labeled-images",
            "yolo_export": "GET /api/exports/yolo-detections",
            "images": "GET /api/images",
            "videos": "GET /api/videos",
            "detections": "GET /api/detections",
            "classifications": "GET /api/classifications",
            "reviews": "GET/PUT /api/reviews/{image_id}",
            "stats": "GET /api/stats",
        },
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint with model status."""
    try:
        from app.services.detector import get_detector
        from app.services.classifier import get_classifier

        detector = get_detector()
        classifier = get_classifier()

        return {
            "status": "healthy",
            "detector_loaded": detector.is_loaded,
            "classifier_loaded": classifier.is_loaded,
            "version": "1.0.0",
            "mode": "production" if (detector.is_loaded and classifier.is_loaded) else "demo",
            "available_detectors": detector.list_available_detectors(),
        }
    except Exception:
        return {
            "status": "healthy",
            "detector_loaded": False,
            "classifier_loaded": False,
            "version": "1.0.0",
            "mode": "demo",
            "available_detectors": [],
        }


@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("Wildlife Detection & Classification System")
    logger.info("eDNA Research Lab — SAIT")
    logger.info("=" * 60)
    logger.info(f"Upload directory: {UPLOAD_DIR}")
    logger.info("Loading models...")

    # Pre-load models on startup
    from app.services.detector import get_detector
    from app.services.classifier import get_classifier

    detector = get_detector()
    classifier = get_classifier()

    if detector.is_loaded:
        loaded = [item["label"] for item in detector.list_available_detectors() if item["mode"] == "real"]
        logger.info("✓ Loaded detectors: %s", ", ".join(loaded))
    else:
        logger.info("⚠ Detector running in MOCK mode")

    if classifier.is_loaded:
        logger.info("✓ Classifier model loaded (EfficientNet-B3)")
    else:
        logger.info("⚠ Classifier running in MOCK mode")

    logger.info("=" * 60)
    logger.info("API ready at http://localhost:8000")
    logger.info("API docs at http://localhost:8000/docs")
    logger.info("=" * 60)
