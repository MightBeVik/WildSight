import React, { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';

export default function Upload({ onProcessed, addToast }) {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confidence, setConfidence] = useState(0.3);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleFiles = useCallback((newFiles) => {
    const imageFiles = Array.from(newFiles).filter(f =>
      f.type.startsWith('image/')
    );
    if (imageFiles.length === 0) {
      addToast('Please select image files (JPG, PNG, etc.)', 'warning');
      return;
    }
    setFiles(prev => [
      ...prev,
      ...imageFiles.map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        displayName: f.webkitRelativePath || f.name,
        status: 'pending',
        result: null,
      })),
    ]);
  }, [addToast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const processAll = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    const updated = [...files];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status !== 'pending') continue;

      updated[i].status = 'processing';
      setFiles([...updated]);

      try {
        const result = await api.processImage(updated[i].file, confidence);
        const comparedModels = result.comparisons?.detectorOrder?.length || 1;
        updated[i].status = 'done';
        updated[i].result = result;
        onProcessed(result);
        addToast(
          result.detection.has_animal
            ? `${result.classification?.classifications?.length || 0} animal(s) detected in ${updated[i].displayName} across ${comparedModels} detector${comparedModels !== 1 ? 's' : ''}`
            : `No animals in ${updated[i].displayName} across ${comparedModels} detector${comparedModels !== 1 ? 's' : ''}`,
          result.detection.has_animal ? 'success' : 'info'
        );
      } catch (err) {
        updated[i].status = 'error';
        updated[i].error = err.message;
        addToast(`Failed to process ${updated[i].displayName}: ${err.message}`, 'error');
      }
      setFiles([...updated]);
    }
    setProcessing(false);
  };

  const downloadLabeledZip = async () => {
    setDownloadingZip(true);
    try {
      const { blob, filename } = await api.downloadLabeledImages();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('Downloaded labeled image ZIP', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setDownloadingZip(false);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    files.forEach(f => URL.revokeObjectURL(f.preview));
    setFiles([]);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Upload Camera Trap Images</h1>
        <p className="page-description">
          Drag and drop or browse to upload wildlife camera trap images for automated multi-model detection and classification.
        </p>
      </div>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        id="upload-dropzone"
      >
        <div className="upload-icon-text">+</div>
        <div className="upload-title">Drop camera trap images here</div>
        <div className="upload-subtitle">
          Supports JPG, PNG, TIFF, BMP, WebP — Single image, full folder, or batch upload
        </div>
        <div className="upload-action-row">
          <button
            className="upload-btn"
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            id="upload-browse-btn"
          >
            Browse Files
          </button>
          <button
            className="btn btn-secondary upload-folder-btn"
            onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
            type="button"
          >
            Browse Folder
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          accept="image/*"
          multiple
          hidden
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          accept="image/*"
          multiple
          webkitdirectory=""
          directory=""
          hidden
        />
      </div>

      {files.length > 0 && (
        <div className="slider-container">
          <span className="slider-label">Detection Confidence:</span>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
          />
          <span className="slider-value">{(confidence * 100).toFixed(0)}%</span>
        </div>
      )}

      {files.length > 0 && (
        <>
          <div className="upload-toolbar">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {files.length} image{files.length !== 1 ? 's' : ''} selected
            </h3>
            <div className="upload-toolbar-actions">
              <button
                className="btn btn-secondary"
                onClick={downloadLabeledZip}
                disabled={downloadingZip || !files.some(f => f.status === 'done')}
                type="button"
              >
                {downloadingZip ? 'Preparing ZIP...' : 'Download Labeled ZIP'}
              </button>
              <button className="btn btn-secondary" onClick={clearAll} disabled={processing}>
                Clear All
              </button>
              <button
                className="btn btn-primary"
                onClick={processAll}
                disabled={processing || files.every(f => f.status !== 'pending')}
                id="process-all-btn"
              >
                {processing ? (
                  <><span className="spinner" /> Processing...</>
                ) : (
                  'Process All'
                )}
              </button>
            </div>
          </div>

          <div className="file-list">
            {files.map((f, i) => (
              <div className="file-item" key={i}>
                <img src={f.preview} alt="" className="file-thumb" />
                <div className="file-info">
                  <div className="file-name">{f.displayName}</div>
                  <div className="file-size">{formatSize(f.file.size)}</div>
                </div>
                {f.status === 'processing' && (
                  <div className="file-status processing">
                    <span className="spinner" /> Analyzing...
                  </div>
                )}
                {f.status === 'done' && (
                  <div className="file-status done">
                    {f.result?.detection?.has_animal
                      ? `${f.result.classification?.classifications?.length || 0} animal(s) • ${f.result?.comparisons?.detectorOrder?.length || 1} model(s)`
                      : 'No animals'}
                  </div>
                )}
                {f.status === 'error' && (
                  <div className="file-status error">Error</div>
                )}
                {f.status === 'pending' && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => removeFile(i)}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
