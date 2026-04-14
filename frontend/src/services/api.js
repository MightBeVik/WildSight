/**
 * API service for communicating with the FastAPI backend.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const api = {
  /**
   * Upload a single video file.
   */
  async uploadVideo(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/videos/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Video upload failed');
    }
    return res.json();
  },

  /**
   * Upload a single image file.
   */
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  /**
   * Upload multiple images.
   */
  async uploadBatch(files) {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/api/upload/batch`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Batch upload failed');
    return res.json();
  },

  /**
   * Download all labeled processed images as a ZIP archive.
   */
  async downloadLabeledImages(detectorKey = 'primary') {
    const res = await fetch(`${API_BASE}/api/exports/labeled-images?detector_key=${encodeURIComponent(detectorKey)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to download labeled images');
    }

    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^\"]+)"?/i);
    return {
      blob: await res.blob(),
      filename: match?.[1] || 'wildsight_labeled_images.zip',
    };
  },

  /**
   * Download YOLO-format detections as a ZIP archive.
   */
  async downloadYoloDetections(detectorKey = 'primary', exportTarget = 'review') {
    const params = new URLSearchParams({
      detector_key: detectorKey,
      export_target: exportTarget,
      approved_only: exportTarget === 'train_model' ? 'true' : 'false',
    });
    const res = await fetch(`${API_BASE}/api/exports/yolo-detections?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to export YOLO detections');
    }

    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^\"]+)"?/i);
    return {
      blob: await res.blob(),
      filename: match?.[1] || 'wildsight_yolo_export.zip',
    };
  },

  /**
   * List all uploaded images.
   */
  async getImages() {
    const res = await fetch(`${API_BASE}/api/images`);
    if (!res.ok) throw new Error('Failed to fetch images');
    return res.json();
  },

  /**
   * Run detection on an image.
   */
  async detectAnimals(imageId, confidence = 0.3, models = 'all') {
    const res = await fetch(
      `${API_BASE}/api/detect/${imageId}?confidence=${confidence}&models=${encodeURIComponent(models)}`,
      { method: 'POST' }
    );
    if (!res.ok) throw new Error('Detection failed');
    return res.json();
  },

  /**
   * Run species classification on an image (requires detection first).
   */
  async classifySpecies(imageId, detectorKey = 'primary') {
    const res = await fetch(`${API_BASE}/api/classify/${imageId}?detector_key=${encodeURIComponent(detectorKey)}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Classification failed');
    return res.json();
  },

  /**
   * Get all detection results.
   */
  async getDetections() {
    const res = await fetch(`${API_BASE}/api/detections`);
    if (!res.ok) throw new Error('Failed to fetch detections');
    return res.json();
  },

  /**
   * Get all classification results.
   */
  async getClassifications() {
    const res = await fetch(`${API_BASE}/api/classifications`);
    if (!res.ok) throw new Error('Failed to fetch classifications');
    return res.json();
  },

  /**
   * Get system stats.
   */
  async getStats() {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  /**
   * Get review state for one image and detector.
   */
  async getReviews(imageId, detectorKey = 'primary') {
    const res = await fetch(`${API_BASE}/api/reviews/${imageId}?detector_key=${encodeURIComponent(detectorKey)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to fetch review state');
    }
    return res.json();
  },

  /**
   * Save approval/rejection/correction feedback for one detection.
   */
  async saveReview(imageId, payload) {
    const res = await fetch(`${API_BASE}/api/reviews/${imageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save review');
    }
    return res.json();
  },

  /**
   * Health check.
   */
  async healthCheck() {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  /**
   * Delete an image.
   */
  async deleteImage(imageId) {
    const res = await fetch(`${API_BASE}/api/images/${imageId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Delete failed');
    return res.json();
  },

  /**
   * Analyze a video by sampling frames.
   */
  async analyzeVideo(videoId, confidence = 0.3, sampleSeconds = 1, models = 'all') {
    const params = new URLSearchParams({
      confidence: String(confidence),
      sample_seconds: String(sampleSeconds),
      models,
    });
    const res = await fetch(`${API_BASE}/api/videos/process/${videoId}?${params.toString()}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Video processing failed');
    }
    return res.json();
  },

  /**
   * Full video pipeline: upload -> analyze sampled frames.
   */
  async processVideo(file, confidence = 0.3, sampleSeconds = 1, models = 'all') {
    const upload = await this.uploadVideo(file);
    const analysis = await this.analyzeVideo(upload.video_id, confidence, sampleSeconds, models);
    return {
      upload,
      analysis,
    };
  },

  /**
   * Full pipeline: upload → detect → classify
   */
  async processImage(file, confidence = 0.3, models = 'all') {
    const upload = await this.uploadImage(file);
    const detection = await this.detectAnimals(upload.image_id, confidence, models);
    const detectionsByModel = detection.by_detector || {
      [detection.primary_detector || detection.detector_key || 'primary']: detection,
    };
    const detectorOrder = detection.detector_order || Object.keys(detectionsByModel);
    const availableDetectors = detection.available_detectors || [];
    const classificationsByModel = {};
    const classificationErrors = {};

    const runs = await Promise.allSettled(
      detectorOrder
        .filter(detectorKey => detectionsByModel[detectorKey]?.has_animal)
        .map(async detectorKey => {
          const classification = await this.classifySpecies(upload.image_id, detectorKey);
          return [detectorKey, classification];
        })
    );

    runs.forEach(result => {
      if (result.status === 'fulfilled') {
        const [detectorKey, classification] = result.value;
        classificationsByModel[detectorKey] = classification;
        return;
      }

      classificationErrors.unknown = result.reason?.message || 'Classification failed';
    });

    const primaryDetector = detection.primary_detector || detectorOrder[0];
    let classification = classificationsByModel[primaryDetector] || null;

    if (!classification && detection.has_animal) {
      classification = await this.classifySpecies(upload.image_id, primaryDetector);
      classificationsByModel[primaryDetector] = classification;
    }

    return {
      upload,
      detection,
      classification,
      comparisons: {
        primaryDetector,
        detectorOrder,
        detectionsByModel,
        classificationsByModel,
        availableDetectors,
        classificationErrors,
      },
    };
  },
};
