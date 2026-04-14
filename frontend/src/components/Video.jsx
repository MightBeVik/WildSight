import React, { useRef, useState } from 'react';
import { api } from '../services/api';

export default function Video({ addToast }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [confidence, setConfidence] = useState(0.3);
  const [sampleSeconds, setSampleSeconds] = useState(1);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleVideo = (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      addToast('Please choose a video file', 'warning');
      return;
    }

    if (selectedVideo?.preview) {
      URL.revokeObjectURL(selectedVideo.preview);
    }

    setSelectedVideo({
      file,
      preview: URL.createObjectURL(file),
    });
    setResult(null);
  };

  const processVideo = async () => {
    if (!selectedVideo?.file) return;
    setProcessing(true);
    try {
      const processed = await api.processVideo(selectedVideo.file, confidence, sampleSeconds);
      setResult(processed);
      addToast('Video analysis complete', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const clearVideo = () => {
    if (selectedVideo?.preview) {
      URL.revokeObjectURL(selectedVideo.preview);
    }
    setSelectedVideo(null);
    setResult(null);
  };

  const analysis = result?.analysis;
  const keyFrames = analysis?.frames || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Video Analysis</h1>
        <p className="page-description">
          Upload a wildlife video and analyze sampled frames without rebuilding the image workflow.
        </p>
      </div>

      <div className="upload-zone video-zone" onClick={() => fileInputRef.current?.click()}>
        <div className="upload-icon-text">▶</div>
        <div className="upload-title">Drop or browse a wildlife video</div>
        <div className="upload-subtitle">
          Supports MP4, MOV, AVI, MKV, WebM — sampled-frame analysis with detector and classifier results.
        </div>
        <div className="upload-action-row">
          <button
            className="upload-btn"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Browse Video
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          accept="video/*"
          hidden
          onChange={(event) => handleVideo(event.target.files?.[0])}
        />
      </div>

      {selectedVideo && (
        <>
          <div className="video-layout">
            <div className="card video-preview-card">
              <div className="card-header">
                <div className="card-title">Selected Video</div>
                <span className="card-badge badge-info">Sampled Analysis</span>
              </div>
              <video className="video-preview" controls src={selectedVideo.preview} />
              <div className="video-filename">{selectedVideo.file.name}</div>
            </div>

            <div className="card video-controls-card">
              <div className="card-header">
                <div className="card-title">Analysis Settings</div>
              </div>

              <div className="slider-stack">
                <div className="slider-container">
                  <span className="slider-label">Detection Confidence:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={confidence}
                    onChange={(event) => setConfidence(parseFloat(event.target.value))}
                  />
                  <span className="slider-value">{(confidence * 100).toFixed(0)}%</span>
                </div>

                <div className="slider-container">
                  <span className="slider-label">Frame Sample Interval:</span>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={sampleSeconds}
                    onChange={(event) => setSampleSeconds(parseFloat(event.target.value))}
                  />
                  <span className="slider-value">{sampleSeconds.toFixed(1)}s</span>
                </div>
              </div>

              <div className="upload-toolbar-actions">
                <button className="btn btn-secondary" type="button" onClick={clearVideo} disabled={processing}>
                  Clear
                </button>
                <button className="btn btn-primary" type="button" onClick={processVideo} disabled={processing}>
                  {processing ? 'Processing Video...' : 'Analyze Video'}
                </button>
              </div>
            </div>
          </div>

          {analysis && (
            <>
              <div className="stats-grid video-stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Duration</div>
                  <div className="stat-value">{analysis.duration_seconds.toFixed(1)}s</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Sampled Frames</div>
                  <div className="stat-value">{analysis.sampled_frames}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Frames With Animals</div>
                  <div className="stat-value">{analysis.frames_with_animals}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Processing Time</div>
                  <div className="stat-value">{(analysis.processing_time_ms / 1000).toFixed(1)}s</div>
                </div>
              </div>

              <div className="card video-summary-card">
                <div className="card-header">
                  <div className="card-title">Species Summary</div>
                  <span className="card-badge badge-success">{Object.keys(analysis.species_counts).length} species</span>
                </div>
                {Object.keys(analysis.species_counts).length > 0 ? (
                  <div className="video-chip-row">
                    {Object.entries(analysis.species_counts).map(([species, count]) => (
                      <span className="video-chip" key={species}>{species} · {count}</span>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '1rem 0 0' }}>
                    <div className="empty-state-text">No species were identified in the sampled frames.</div>
                  </div>
                )}
              </div>

              <div className="video-frame-grid">
                {keyFrames.map((frame) => (
                  <div className="gallery-item video-frame-card" key={`${frame.frame_number}-${frame.sample_number}`}>
                    <img
                      src={frame.annotated_frame_url}
                      alt={`Annotated frame ${frame.sample_number}`}
                      className="gallery-thumb"
                    />
                    <div className="gallery-info">
                      <div className="gallery-filename">
                        {frame.timestamp_seconds.toFixed(1)}s · {frame.detector_label}
                      </div>
                      <div className="gallery-tags">
                        <span className={`gallery-tag ${frame.has_animal ? '' : 'empty'}`}>
                          {frame.has_animal ? `${frame.animal_count} animal(s)` : 'Empty frame'}
                        </span>
                        {frame.classifications.slice(0, 2).map((classification, index) => (
                          <span className="gallery-tag" key={`${frame.frame_number}-${index}`}>
                            {classification.species}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}