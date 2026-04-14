import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export default function Results({ results, addToast }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const latest = results.length > 0 ? results[results.length - 1] : null;

  const comparisonData = latest?.comparisons || {};
  const detectionsByModel = comparisonData.detectionsByModel || (
    latest?.detection
      ? { [latest.detection.primary_detector || latest.detection.detector_key || 'primary']: latest.detection }
      : {}
  );
  const classificationsByModel = comparisonData.classificationsByModel || (
    latest?.classification
      ? { [latest?.detection?.primary_detector || latest?.detection?.detector_key || 'primary']: latest.classification }
      : {}
  );
  const detectorOrder = comparisonData.detectorOrder || Object.keys(detectionsByModel);
  const availableDetectors = comparisonData.availableDetectors || latest?.detection?.available_detectors || [];

  const [selectedDetectorKey, setSelectedDetectorKey] = useState(
    comparisonData.primaryDetector || latest?.detection?.primary_detector || detectorOrder[0] || null
  );
  const [reviewState, setReviewState] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [exportTarget, setExportTarget] = useState('review');
  const [savingReviewIndex, setSavingReviewIndex] = useState(null);
  const [exportingDataset, setExportingDataset] = useState(false);

  const imageId = latest?.upload?.image_id || latest?.detection?.image_id || null;

  useEffect(() => {
    setSelectedDetectorKey(comparisonData.primaryDetector || latest?.detection?.primary_detector || detectorOrder[0] || null);
  }, [latest, comparisonData.primaryDetector, latest?.detection?.primary_detector, detectorOrder]);

  const selectedDetection = selectedDetectorKey ? detectionsByModel[selectedDetectorKey] : null;
  const selectedClassification = selectedDetectorKey ? classificationsByModel[selectedDetectorKey] : null;
  const animalDetections = selectedDetection?.detections?.filter(det => det.category === 'animal') || [];
  const classifications = selectedClassification?.classifications || [];
  const imageUrl = latest?.upload?.filepath || selectedDetection?.image_url || latest?.detection?.image_url;
  const reviews = reviewState?.reviews || [];
  const reviewSummary = reviewState?.summary || {
    approved: 0,
    rejected: 0,
    pending: animalDetections.length,
    total: animalDetections.length,
  };

  useEffect(() => {
    if (!imageId || !selectedDetectorKey || !selectedDetection?.has_animal) {
      setReviewState(null);
      setReviewDrafts({});
      return;
    }

    let cancelled = false;
    api.getReviews(imageId, selectedDetectorKey)
      .then(data => {
        if (cancelled) return;
        setReviewState(data);
        setReviewDrafts(
          data.reviews.reduce((acc, review) => {
            acc[review.detection_index] = {
              correctedLabel: review.corrected_label || '',
              notes: review.notes || '',
            };
            return acc;
          }, {})
        );
      })
      .catch(error => {
        if (!cancelled) {
          setReviewState(null);
          setReviewDrafts({});
          addToast?.(error.message, 'error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageId, selectedDetectorKey, selectedDetection?.has_animal, addToast]);

  useEffect(() => {
    if (!selectedDetection || !canvasRef.current || !imgRef.current) return;

    const img = imgRef.current;
    const canvas = canvasRef.current;

    const drawBoxes = () => {
      const ctx = canvas.getContext('2d');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      animalDetections.forEach((det, index) => {
        const x1 = det.x1 * canvas.width;
        const y1 = det.y1 * canvas.height;
        const x2 = det.x2 * canvas.width;
        const y2 = det.y2 * canvas.height;
        const width = x2 - x1;
        const height = y2 - y1;

        ctx.strokeStyle = '#2d5f2d';
        ctx.lineWidth = Math.max(2, canvas.width * 0.003);
        ctx.strokeRect(x1, y1, width, height);

        const cornerLength = Math.min(width, height) * 0.15;
        ctx.lineWidth = Math.max(3, canvas.width * 0.005);

        ctx.beginPath();
        ctx.moveTo(x1, y1 + cornerLength);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1 + cornerLength, y1);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2 - cornerLength, y1);
        ctx.lineTo(x2, y1);
        ctx.lineTo(x2, y1 + cornerLength);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y2 - cornerLength);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x1 + cornerLength, y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x2 - cornerLength, y2);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 - cornerLength);
        ctx.stroke();

        const cls = classifications[index];
        const label = cls
          ? `${cls.species} ${(cls.confidence * 100).toFixed(0)}%`
          : `Animal ${(det.confidence * 100).toFixed(0)}%`;
        const fontSize = Math.max(14, canvas.width * 0.018);
        const padding = 8;

        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(26, 58, 26, 0.9)';
        ctx.fillRect(x1, y1 - fontSize - padding * 2, textWidth + padding * 2, fontSize + padding * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x1 + padding, y1 - padding);
      });
    };

    if (img.complete) {
      drawBoxes();
    } else {
      img.onload = drawBoxes;
    }
  }, [selectedDetection, animalDetections, classifications]);

  const updateDraft = (detectionIndex, field, value) => {
    setReviewDrafts(prev => ({
      ...prev,
      [detectionIndex]: {
        ...(prev[detectionIndex] || {}),
        [field]: value,
      },
    }));
  };

  const saveReview = async (detectionIndex, status) => {
    if (!imageId || !selectedDetectorKey) return;

    setSavingReviewIndex(detectionIndex);
    try {
      const payload = {
        detector_key: selectedDetectorKey,
        detection_index: detectionIndex,
        status,
        corrected_label: exportTarget === 'train_model' ? reviewDrafts[detectionIndex]?.correctedLabel || null : null,
        notes: reviewDrafts[detectionIndex]?.notes || null,
        export_target: exportTarget,
      };
      const response = await api.saveReview(imageId, payload);
      setReviewState(response.state);
      addToast?.('Review saved', 'success');
    } catch (error) {
      addToast?.(error.message, 'error');
    } finally {
      setSavingReviewIndex(null);
    }
  };

  const exportDataset = async () => {
    setExportingDataset(true);
    try {
      const { blob, filename } = await api.downloadYoloDetections(selectedDetectorKey || 'primary', exportTarget);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast?.('YOLO dataset export ready', 'success');
    } catch (error) {
      addToast?.(error.message, 'error');
    } finally {
      setExportingDataset(false);
    }
  };

  if (!latest) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Detection Results</h1>
          <p className="page-description">Detection and classification results will appear here after processing images.</p>
        </div>
        <div className="empty-state">
          <div className="empty-state-title">No results yet</div>
          <div className="empty-state-text">Upload and process images to see detector comparisons with bounding boxes.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Detection Results</h1>
        <p className="page-description">
          {latest.upload?.filename} — compared across {detectorOrder.length} detector{detectorOrder.length !== 1 ? 's' : ''}
        </p>
      </div>

      {detectorOrder.length > 0 && (
        <div className="detector-tabs">
          {detectorOrder.map(detectorKey => {
            const detection = detectionsByModel[detectorKey];
            return (
              <button
                key={detectorKey}
                className={`detector-tab ${detectorKey === selectedDetectorKey ? 'active' : ''}`}
                onClick={() => setSelectedDetectorKey(detectorKey)}
              >
                <span>{detection?.detector_label || detectorKey}</span>
                <span className="detector-tab-meta">
                  {detection?.has_animal ? `${detection.detections.filter(det => det.category === 'animal').length} animal(s)` : 'Empty frame'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="detector-comparison-grid">
        {detectorOrder.map(detectorKey => {
          const detection = detectionsByModel[detectorKey];
          const animalCount = detection?.detections?.filter(det => det.category === 'animal').length || 0;
          return (
            <button
              type="button"
              key={detectorKey}
              className={`detector-compare-card ${detectorKey === selectedDetectorKey ? 'selected' : ''}`}
              onClick={() => setSelectedDetectorKey(detectorKey)}
            >
              <div className="detector-meta-row">
                <strong>{detection?.detector_label || detectorKey}</strong>
                <span className={`card-badge ${detection?.has_animal ? 'badge-success' : 'badge-warning'}`}>
                  {detection?.has_animal ? 'animal found' : 'empty'}
                </span>
              </div>
              <div className="detector-note">{detection?.detector_description}</div>
              <div className="detector-meta-row">
                <span>{animalCount} animal box{animalCount !== 1 ? 'es' : ''}</span>
                <span>{detection?.processing_time_ms?.toFixed(0) || 0}ms</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="results-grid">
        <div className="image-viewer">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Detection result"
            style={{ display: 'none' }}
            crossOrigin="anonymous"
          />
          <canvas ref={canvasRef} style={{ width: '100%', height: 'auto' }} />

          {!selectedDetection?.has_animal && (
            <div style={{ padding: '1rem' }}>
              <div className="no-animal-panel">
                <p>No animals detected by {selectedDetection?.detector_label || 'this detector'}.</p>
              </div>
            </div>
          )}
        </div>

        <div className="detection-sidebar">
          <div className="detection-card">
            <div className="card-header">
              <span className="card-title">Selected Detector</span>
              <span className={`card-badge ${selectedDetection?.has_animal ? 'badge-success' : 'badge-warning'}`}>
                {selectedDetection?.detector_mode || 'unknown'}
              </span>
            </div>
            <div className="species-name" style={{ fontSize: '1.1rem' }}>{selectedDetection?.detector_label || 'No detector selected'}</div>
            <div className="detector-note" style={{ marginTop: '0.5rem' }}>{selectedDetection?.detector_description}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--metric-emphasis)' }}>{animalDetections.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Animal Boxes</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--metric-emphasis)' }}>{classifications.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Species Classified</div>
              </div>
            </div>
            <div className="detector-meta-row" style={{ marginTop: '1rem' }}>
              <span>Inference time</span>
              <span>{selectedDetection?.processing_time_ms?.toFixed(0) || 0}ms</span>
            </div>
          </div>

          <div className="detection-card">
            <div className="card-header">
              <span className="card-title">Review and Export</span>
              <span className="card-badge badge-info">YOLO</span>
            </div>
            <div className="review-mode-group">
              <label className="review-mode-option">
                <input
                  type="radio"
                  name="export-target"
                  value="review"
                  checked={exportTarget === 'review'}
                  onChange={() => setExportTarget('review')}
                />
                <span>Review Export</span>
              </label>
              <label className="review-mode-option">
                <input
                  type="radio"
                  name="export-target"
                  value="train_model"
                  checked={exportTarget === 'train_model'}
                  onChange={() => setExportTarget('train_model')}
                />
                <span>Train Model</span>
              </label>
            </div>
            <div className="review-summary-grid">
              <div className="review-summary-chip">Approved: {reviewSummary.approved}</div>
              <div className="review-summary-chip">Rejected: {reviewSummary.rejected}</div>
              <div className="review-summary-chip">Pending: {reviewSummary.pending}</div>
            </div>
            <div className="detector-note" style={{ marginTop: '0.75rem' }}>
              {exportTarget === 'train_model'
                ? 'Train Model mode exports only approved detections and uses corrected labels when provided.'
                : 'Review Export mode writes YOLO animal boxes from the selected detector output.'}
            </div>
            <button
              className="btn btn-primary review-export-btn"
              type="button"
              disabled={exportingDataset}
              onClick={exportDataset}
            >
              {exportingDataset ? 'Preparing YOLO ZIP...' : 'Export YOLO ZIP'}
            </button>
          </div>

          {classifications.length === 0 && selectedDetection?.has_animal && (
            <div className="detection-card">
              <div className="card-title">Classification Pending</div>
              <div className="detector-note" style={{ marginTop: '0.5rem' }}>
                Detection ran, but no classification result was returned for this detector yet.
              </div>
            </div>
          )}

          {classifications.map((cls, index) => (
            <div className="detection-card" key={index}>
              <div className="card-header">
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Detection #{index + 1}
                </span>
              </div>
              <div className="species-name">{cls.species}</div>
              <div className="species-confidence">
                <div className="confidence-bar">
                  <div
                    className={`confidence-fill ${cls.confidence >= 0.7 ? 'high' : cls.confidence >= 0.4 ? 'medium' : 'low'}`}
                    style={{ width: `${cls.confidence * 100}%` }}
                  />
                </div>
                <span className="confidence-label">{(cls.confidence * 100).toFixed(1)}%</span>
              </div>

              {cls.top_5 && cls.top_5.length > 1 && (
                <div className="top-predictions">
                  <h4>Other Possibilities</h4>
                  {cls.top_5.slice(1).map((prediction, predictionIndex) => (
                    <div className="prediction-row" key={predictionIndex}>
                      <span className="prediction-species">{prediction.species}</span>
                      <span className="prediction-conf">{(prediction.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="review-panel">
                <div className="review-status-row">
                  <span className={`review-status-badge status-${reviews[index]?.status || 'pending'}`}>
                    {reviews[index]?.status || 'pending'}
                  </span>
                  <span className="review-prediction-copy">
                    Predicted: {reviews[index]?.predicted_label || cls.species}
                  </span>
                </div>
                <div className="review-action-row">
                  <button
                    type="button"
                    className="btn btn-secondary review-btn-approve"
                    disabled={savingReviewIndex === index}
                    onClick={() => saveReview(index, 'approved')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary review-btn-reject"
                    disabled={savingReviewIndex === index}
                    onClick={() => saveReview(index, 'rejected')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={savingReviewIndex === index}
                    onClick={() => saveReview(index, 'pending')}
                  >
                    Reset
                  </button>
                </div>

                {exportTarget === 'train_model' && (
                  <div className="review-feedback-block">
                    <label className="review-field-label" htmlFor={`corrected-label-${index}`}>
                      Corrected label for training
                    </label>
                    <input
                      id={`corrected-label-${index}`}
                      className="review-input"
                      type="text"
                      value={reviewDrafts[index]?.correctedLabel || ''}
                      onChange={(event) => updateDraft(index, 'correctedLabel', event.target.value)}
                      placeholder={cls.species}
                    />
                    <label className="review-field-label" htmlFor={`review-notes-${index}`}>
                      Notes
                    </label>
                    <textarea
                      id={`review-notes-${index}`}
                      className="review-textarea"
                      rows="3"
                      value={reviewDrafts[index]?.notes || ''}
                      onChange={(event) => updateDraft(index, 'notes', event.target.value)}
                      placeholder="Optional review note"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          {availableDetectors.some(detector => detector.mode === 'unavailable') && (
            <div className="detection-card">
              <div className="card-title">Waiting on More Models</div>
              <div className="top-predictions" style={{ marginTop: '0.75rem' }}>
                {availableDetectors
                  .filter(detector => detector.mode === 'unavailable')
                  .map(detector => (
                    <div className="prediction-row" key={detector.key}>
                      <span className="prediction-species">{detector.label}</span>
                      <span className="prediction-conf">{detector.error || 'Not loaded'}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
