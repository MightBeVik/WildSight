import React from 'react';

const workflowSteps = [
  {
    id: '01',
    title: 'Upload imagery',
    text: 'Import individual camera-trap images or full folders from the Images tab for batch screening.',
  },
  {
    id: '02',
    title: 'Compare detectors',
    text: 'Run MegaDetector, Generic YOLO, and the new MegaMod detector side by side to inspect which model isolates wildlife best.',
  },
  {
    id: '03',
    title: 'Classify species',
    text: 'EfficientNet-B3 ranks likely species for each detected animal crop and returns confidence scores.',
  },
  {
    id: '04',
    title: 'Review and export',
    text: 'Approve or reject detections, correct labels for training, and export YOLO-ready review or training datasets.',
  },
];

const modules = [
  {
    id: 'MOD_01',
    title: 'Multi-model detection',
    text: 'Runs wildlife-object detection on trail camera images with three detector options so the team can compare baseline and custom behavior.',
    meta: 'MegaDetector + Generic YOLO + MegaMod',
  },
  {
    id: 'MOD_02',
    title: 'Species classification',
    text: 'Uses EfficientNet-B3 to classify detected crops into likely wildlife species with ranked predictions.',
    meta: 'EfficientNet-B3 + ranked outputs',
  },
  {
    id: 'MOD_03',
    title: 'Review to training loop',
    text: 'Supports approval, rejection, corrected labels, and YOLO export so reviewed detections can become future training data.',
    meta: 'Human review + YOLO export',
  },
  {
    id: 'MOD_04',
    title: 'Batch and video workflows',
    text: 'Supports folder uploads, downloadable outputs, and sampled-frame video analysis in a separate tab for longer clips.',
    meta: 'Images + folders + sampled video frames',
  },
];

const localLinks = [
  {
    label: 'Frontend app',
    href: 'http://localhost:5173/',
    note: 'Main local interface for image, video, results, dashboard, and gallery testing.',
  },
  {
    label: 'Backend docs',
    href: 'http://localhost:8000/docs',
    note: 'FastAPI Swagger UI for direct endpoint inspection and manual API testing.',
  },
  {
    label: 'Health endpoint',
    href: 'http://localhost:8000/api/health',
    note: 'Quick status check for detector and classifier readiness, including MegaMod.',
  },
];

export default function Landing({ setActivePage, apiStatus }) {
  return (
    <div className="landing-shell">
      <section className="landing-hero">
        <div className="landing-hero-copy landing-panel">
          <div className="landing-kicker">Wildlife Detection System v2.5</div>
          <h1 className="landing-title">
            Detect. Classify.
            <br />
            Understand.
          </h1>
          <p className="landing-description">
            WildSight helps camera-trap teams turn raw field imagery into organized wildlife detections,
            species predictions, review decisions, and YOLO-ready export sets for future model improvement.
          </p>

          <div className="landing-actions">
            <button className="landing-primary-btn" onClick={() => setActivePage('images')}>
              Upload Images
            </button>
            <button className="landing-secondary-btn" onClick={() => setActivePage('video')}>
              Video Analysis
            </button>
          </div>

          <div className="landing-stat-row">
            <div className="landing-stat-card">
              <span className="landing-stat-value">3</span>
              <span className="landing-stat-label">Loaded detectors</span>
            </div>
            <div className="landing-stat-card">
              <span className="landing-stat-value">MegaMod</span>
              <span className="landing-stat-label">Custom local detector</span>
            </div>
            <div className="landing-stat-card">
              <span className="landing-stat-value">EfficientNet-B3</span>
              <span className="landing-stat-label">Species classifier</span>
            </div>
            <div className="landing-stat-card">
              <span className="landing-stat-value">{apiStatus === 'online' ? 'Live' : 'Offline'}</span>
              <span className="landing-stat-label">Backend status</span>
            </div>
          </div>

          <div className="landing-inline-note">
            Current build supports folder upload, sampled video analysis, reviewed detections, and YOLO export for training.
          </div>
        </div>

        <div className="landing-hero-visual landing-panel">
          <div className="landing-visual-header">
            <div className="landing-visual-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="landing-visual-title">WildSight Processing Pipeline</span>
          </div>

          <div className="landing-visual-screen">
            <div className="landing-screen-topline">
              <span>Image and video workflows</span>
              <span>FastAPI + React</span>
            </div>
            <div className="landing-screen-grid" />
            <div className="landing-screen-overlay">
              <div className="landing-screen-box" />
              <div className="landing-screen-animal" />
            </div>
            <div className="landing-screen-peaks" />
            <div className="landing-screen-timestamp">Detection to crop to classification to export</div>
          </div>

          <div className="landing-feed-metrics">
            <div className="landing-feed-row">
              <span>Input modes</span>
              <strong>Images, folders, video</strong>
            </div>
            <div className="landing-feed-row emphasis">
              <span>Detector stage</span>
              <strong>MegaDetector, Generic YOLO, MegaMod</strong>
            </div>
            <div className="landing-feed-row">
              <span>Classifier stage</span>
              <strong>EfficientNet-B3 species ranking</strong>
            </div>
            <div className="landing-feed-row">
              <span>Outputs</span>
              <strong>Results, review state, labeled ZIP, YOLO ZIP</strong>
            </div>
          </div>

          <div className="landing-feed-footer">
            <span className={`landing-status-indicator ${apiStatus === 'online' ? 'online' : 'offline'}`} />
            <span>{apiStatus === 'online' ? 'Backend connected and ready for analysis' : 'Backend offline, frontend preview still available'}</span>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-header">
          <span className="landing-section-label">Quick How It Works</span>
          <h2>From raw camera-trap input to review-ready outputs</h2>
        </div>

        <div className="landing-workflow-grid">
          {workflowSteps.map(step => (
            <article className="landing-workflow-card" key={step.id}>
              <span className="landing-workflow-id">{step.id}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-modules-section">
        <div className="landing-section-header">
          <span className="landing-section-label">Core Modules</span>
          <h2>What the tool is built to do</h2>
        </div>

        <div className="landing-modules-grid">
          {modules.map(module => (
            <article className="landing-module-card" key={module.id}>
              <span className="landing-module-id">{module.id}</span>
              <h3>{module.title}</h3>
              <p>{module.text}</p>
              <div className="landing-module-meta">{module.meta}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-header">
          <span className="landing-section-label">Local Testing</span>
          <h2>Use these endpoints while you test</h2>
        </div>

        <div className="landing-links-grid">
          {localLinks.map(link => (
            <article className="landing-link-card" key={link.href}>
              <span className="landing-link-label">{link.label}</span>
              <a className="landing-link-url" href={link.href} target="_blank" rel="noreferrer">
                {link.href}
              </a>
              <p>{link.note}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}