// FIX: Some themes render this app block's markup twice on the same page
// (for example, separate desktop/mobile layout wrappers that are toggled with
// CSS media queries). Because this script relies on unique element IDs
// (getElementById, single-element querySelector), a second copy in the DOM
// causes duplicate controls to appear (e.g. two upload buttons) and can make
// this script bind to a hidden copy while a differently-styled copy is the
// one actually shown - which also explains loading/animation states seeming
// to "not work". This runs first and removes any extra copies, keeping only
// the one that is actually visible, before the rest of the script queries
// the DOM. Pages with a single instance of the block are unaffected.
(function removeDuplicateBeautyxiaInstances() {
  const containers = document.querySelectorAll('.bxa-my-app-container');
  if (containers.length <= 1) return;

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const visibleContainers = Array.from(containers).filter(isVisible);
  const containerToKeep = visibleContainers[0] || containers[0];

  containers.forEach((container) => {
    if (container !== containerToKeep) {
      container.remove();
    }
  });
})();

// Fetch the limit from the schema settings, defaulting to 'all'
const maxProductsLimit = window.BeautyxiaConfig.maxProductsLimit;

// Get current language from the container's data attribute
let currentLanguage = 'en';
let lastAnalysisData = null;

function getCurrentLanguage() {
  const appContainer = document.querySelector('.bxa-my-app-container');
  return appContainer ? (appContainer.dataset.currentLang || 'en') : 'en';
}

function updateLanguage() {
  currentLanguage = getCurrentLanguage();

  // Update direction only on the app container, not the entire document
  const appContainer = document.querySelector('.bxa-my-app-container');
  if (appContainer) {
    appContainer.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';
  }

  // Keep lang attribute on document for accessibility/SEO
  document.documentElement.lang = currentLanguage;

}

// Initialize language on page load
document.addEventListener('DOMContentLoaded', function () {
  // Set initial language from container
  updateLanguage();

  // Initialize feedback button handlers
  initializeFeedbackHandlers();
});

const input = document.getElementById('picture');
const preview = document.getElementById('preview-image');
const previewPlaceholder = document.getElementById('preview-placeholder');
const previewContainer = document.querySelector('.bxa-face-analysis-preview');
const scanOverlay = document.getElementById('scan-overlay');
const analyzeBtn = document.getElementById('analyze-btn');
const consentCheckbox = document.getElementById('consent');

const resultsSection = document.getElementById('results-section');
const analysisImages = document.getElementById('analysis-images');
const yoloImage = document.getElementById('yolo-annotated-image');
const segmentationImage = document.getElementById('segmentation-overlay-image');
const productRecommendations = document.getElementById('product-recommendations');
const activeFiltersDiv = document.getElementById('active-filters');
const productItems = document.querySelectorAll('.bxa-product-item');
const noProductsDiv = document.getElementById('no-products');
const loadingSection = document.getElementById('loading-section');

const webcamBtn = document.getElementById('webcam-btn');
const captureBtn = document.getElementById('capture-btn');
const stopCameraBtn = document.getElementById('stop-camera-btn');
const webcamSection = document.getElementById('webcam-section');
const webcamVideo = document.getElementById('webcam-video');
const webcamCanvas = document.getElementById('webcam-canvas');

let webcamStream = null;
let uploadedFile = null;

function updateAnalyzeButton() {
  const hasFile = uploadedFile !== null;
  const hasConsent = consentCheckbox.checked;
  analyzeBtn.disabled = !(hasFile && hasConsent);
}

consentCheckbox.addEventListener('change', function() {
  updateAnalyzeButton();
});

input.addEventListener('change', function () {
  const file = this.files[0];
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    previewPlaceholder.style.display = 'none';
    uploadedFile = file;
    updateAnalyzeButton();
    hideResults();
    hideWebcam();
  }
});

webcamBtn.addEventListener('click', function() {
  startWebcam();
});

captureBtn.addEventListener('click', function() {
  capturePhoto();
});

stopCameraBtn.addEventListener('click', function() {
  hideWebcam();
});

function startWebcam() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(function(stream) {
      webcamStream = stream;
      webcamVideo.srcObject = stream;
      webcamSection.style.display = 'block';
      captureBtn.style.display = 'inline-flex';
      stopCameraBtn.style.display = 'inline-flex';
      webcamBtn.style.display = 'none';
    })
    .catch(function(err) {
      console.error('Error accessing camera:', err);
    });
}

function capturePhoto() {
  const context = webcamCanvas.getContext('2d');
  context.drawImage(webcamVideo, 0, 0, 256, 256);

  webcamCanvas.toBlob(function(blob) {
    uploadedFile = new File([blob], 'webcam-photo.jpg', { type: 'image/jpeg' });
    preview.src = URL.createObjectURL(blob);
    preview.style.display = 'block';
    previewPlaceholder.style.display = 'none';
    updateAnalyzeButton();
    hideResults();
    hideWebcam();
  }, 'image/jpeg', 0.8);
}

function hideWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  webcamSection.style.display = 'none';
  captureBtn.style.display = 'none';
  stopCameraBtn.style.display = 'none';
  webcamBtn.style.display = 'inline-flex';
}

function hideResults() {
  resultsSection.style.display = 'none';
  analysisImages.style.display = 'none';
  productRecommendations.style.display = 'none';
  loadingSection.style.display = 'none';
  loadingSection.classList.remove('bxa-is-visible');
  stopScanAnimation();
  // Hide feedback section when hiding results
  const feedbackSection = document.getElementById('feedbackSection');
  if (feedbackSection) {
    feedbackSection.style.display = 'none';
  }
}

// Toggles the animated scanner overlay (sweeping line, corner brackets,
// pulsing landmark points) on top of the uploaded photo while analysis
// is in progress.
//
// Some shop themes use broad selectors like [class*="overlay"] { display:
// none !important; } or blanket-disable all CSS animations, which can
// silently defeat a class-only toggle (same root cause documented for
// loadingSection above). Belt-and-suspenders fix: in addition to the
// bxa-is-scanning class (which the hardened CSS in style.css targets with
// its own !important rules), also set the critical properties inline with
// 'important' priority. An inline !important declaration outranks an
// external stylesheet's !important declaration in the CSS cascade, so this
// wins even against themes the class-only approach can't beat.
function startScanAnimation() {
  if (previewContainer) {
    previewContainer.classList.add('bxa-is-scanning');
    previewContainer.style.setProperty('position', 'relative', 'important');
  }
  if (scanOverlay) {
    scanOverlay.classList.add('bxa-is-scanning');
    scanOverlay.style.setProperty('display', 'block', 'important');
    scanOverlay.style.setProperty('opacity', '1', 'important');
    scanOverlay.style.setProperty('visibility', 'visible', 'important');
  }
}

function stopScanAnimation() {
  if (previewContainer) {
    previewContainer.classList.remove('bxa-is-scanning');
  }
  if (scanOverlay) {
    scanOverlay.classList.remove('bxa-is-scanning');
    scanOverlay.style.setProperty('opacity', '0', 'important');
    scanOverlay.style.setProperty('visibility', 'hidden', 'important');
  }
}

analyzeBtn.addEventListener('click', function () {
  if (!uploadedFile || !consentCheckbox.checked) {
    return;
  }

  const formData = new FormData();
  formData.append('photo', uploadedFile);

  hideResults();
  loadingSection.style.display = 'block';
  loadingSection.classList.add('bxa-is-visible');
  startScanAnimation();
  analyzeBtn.disabled = true;

  // Use data attribute for analyzing text
  const analyzingText = analyzeBtn.getAttribute('data-text-analyzing') || 'Analyzing...';
  analyzeBtn.querySelector('.button-text').textContent = analyzingText;

  // Hardcoded API endpoint
  const apiEndpoint = 'https://glutton-snowboard-detoxify.ngrok-free.dev/upload/';

  fetch(apiEndpoint, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
  .then(response => {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return response.text().then(text => {
        throw new Error(`Server returned ${contentType || 'unknown content type'} instead of JSON`);
      });
    }
    return response.json();
  })
  .then(data => {
    loadingSection.style.display = 'none';
    loadingSection.classList.remove('bxa-is-visible');
    stopScanAnimation();
    updateAnalyzeButton();

    // Use data attribute for analyze button text
    const analyzeText = analyzeBtn.getAttribute('data-text-analyze') || 'Analyze Face';
    analyzeBtn.querySelector('.button-text').textContent = analyzeText;

    if (data.error) {
      alert(data.error); 
      console.error('API Error:', data.error);
    } else {
      displayResults(data);
    }
  })
  .catch(err => {
    loadingSection.style.display = 'none';
    loadingSection.classList.remove('bxa-is-visible');
    stopScanAnimation();
    updateAnalyzeButton();

    // Use data attribute for analyze button text
    const analyzeText = analyzeBtn.getAttribute('data-text-analyze') || 'Analyze Face';
    analyzeBtn.querySelector('.button-text').textContent = analyzeText;

    console.error('Analysis failed:', err);
  });
});

function displayResults(data) {
  lastAnalysisData = data;
  const issuesContainer = document.getElementById('detected-issues');
  issuesContainer.innerHTML = '';

  // Show analyzed face
  if (data.cropped_face) {
    document.getElementById('analyzed-face').src = data.cropped_face;
  }

  // Display skin type
  if (data.skin_type) {
    document.getElementById('skin-type-value').textContent = data.skin_type;
    // Display probabilities
    if (data.type_probs && data.type_probs.length === 3) {
      const probContainer = document.getElementById('skin-probabilities');
      const types = ['Dry', 'Normal', 'Oily'];
      probContainer.innerHTML = types.map((type, index) => `
        <div class="bxa-probability-bar">
          <div class="bxa-prob-label">
            <span>${type}</span>
            <span>${(data.type_probs[index] * 100).toFixed(1)}%</span>
          </div>
          <div class="bxa-prob-track">
            <div class="bxa-prob-fill" style="width: ${data.type_probs[index] * 100}%"></div>
          </div>
        </div>
      `).join('');
    }
  }

  // Display eye colors
  if (data.left_eye_color) {
    document.getElementById('left-eye-color').textContent = data.left_eye_color;
  }
  if (data.right_eye_color) {
    document.getElementById('right-eye-color').textContent = data.right_eye_color;
  }

  // Display acne information
  if (data.acne_pred && data.acne_confidence) {
    document.getElementById('acne-level').textContent = data.acne_pred;
    const confidence = data.acne_confidence * 100;
    document.getElementById('acne-confidence').textContent = `${confidence.toFixed(1)}%`;
    document.getElementById('acne-confidence-fill').style.width = `${confidence}%`;
  }

  const allDetectedIssues = {};
  // Process YOLO detection results
  if (data.yolo_boxes && data.yolo_boxes.length > 0) {
    data.yolo_boxes.forEach(box => {
      const issueType = box.label || box.class || 'Unknown';
      if (allDetectedIssues[issueType]) {
        allDetectedIssues[issueType].count++;
        allDetectedIssues[issueType].maxConfidence = Math.max(allDetectedIssues[issueType].maxConfidence, box.confidence || 0);
      } else {
         allDetectedIssues[issueType] = {
          count: 1,
          maxConfidence: box.confidence || 0
        };
      }
    });
  }

  if (data.segmentation_results) {
    let segmentationIssues = [];
    if (Array.isArray(data.segmentation_results)) {
      segmentationIssues = data.segmentation_results
        .map(result => {
          if (typeof result === 'string') {
            return result;
          } else if (result && typeof result === 'object') {
            return result.class || result.label || result.name || '';
          }
          return '';
        })
        .filter(issue => issue.length > 0);
    } else if (typeof data.segmentation_results === 'object') {
      segmentationIssues = Object.entries(data.segmentation_results)
        .filter(([key, value]) => Boolean(value))
        .map(([key, value]) => key);
    }

    segmentationIssues.forEach(issue => {
      if (allDetectedIssues[issue]) {
        allDetectedIssues[issue].count++;
      } else {
        allDetectedIssues[issue] = {
          count: 1,
          maxConfidence: 0.8
        };
      }
    });
  }

  if (Object.keys(allDetectedIssues).length > 0) {
    issuesContainer.innerHTML = Object.entries(allDetectedIssues).map(([issue, data]) => `
      <div class="bxa-issue-item">
        <div class="bxa-issue-info">
          <span class="bxa-issue-name">${issue}</span>
          <span class="bxa-issue-count">${data.count} area${data.count > 1 ? 's' : ''}</span>
        </div>
        <div class="bxa-issue-confidence">
          <div class="bxa-confidence-bar">
            <div class="bxa-confidence-fill" style="width: ${data.maxConfidence * 100}%"></div>
          </div>
          <span class="bxa-confidence-text">${(data.maxConfidence * 100).toFixed(1)}%</span>
        </div>
      </div>
    `).join('');
  } else {
    // Get no issues text from data attribute
    const noIssuesText = issuesContainer.dataset.noIssuesText || 'No skin issues detected';
    issuesContainer.innerHTML = `
      <div class="bxa-no-issues-message">
        <div class="bxa-no-issues-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 12l2 2 4-4"/>
            <path d="M21 12c.552 0 1-.448 1-1V5c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1"/>
          </svg>
        </div>
        <span class="bxa-no-issues-text">${noIssuesText}</span>
      </div>
    `;
  }

  // Display analysis images
  if (data.yolo_annotated) {
    yoloImage.src = data.yolo_annotated;
    yoloImage.style.display = 'block';
  }

  if (data.segmentation_overlay) {
    segmentationImage.src = data.segmentation_overlay;
    segmentationImage.style.display = 'block';
  }

  if (data.yolo_annotated || data.segmentation_overlay) {
    analysisImages.style.display = 'block';
  }


  showProductRecommendations(data);
  resultsSection.style.display = 'block';

  // Scroll to results so the user sees them
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Show feedback section after results are displayed
  const feedbackSection = document.getElementById('feedbackSection');
  if (feedbackSection) {
    feedbackSection.style.display = 'block';
    resetFeedbackSection();
  }
}

  function showProductRecommendations(analysisData) {
  const filters = [];

  // 1. Gather all filters from analysis results
  if (analysisData.skin_type) {
      filters.push(analysisData.skin_type.toLowerCase());
  }

  if (analysisData.yolo_boxes && analysisData.yolo_boxes.length > 0) {
      const detectedIssues = [...new Set(analysisData.yolo_boxes.map(box => 
      (box.label || box.class || '').toLowerCase()
      ))];
      filters.push(...detectedIssues);
  }

  if (analysisData.segmentation_results && Array.isArray(analysisData.segmentation_results)) {
      const segmentationIssues = analysisData.segmentation_results
      .map(result => {
          if (typeof result === 'string') {
          return result.toLowerCase();
          } else if (result && typeof result === 'object') {
          return (result.class || result.label || result.name || '').toString().toLowerCase();
          }
          return '';
      })
      .filter(issue => issue.length > 0);
      filters.push(...segmentationIssues);
  }

  if (analysisData.acne_pred && parseInt(analysisData.acne_pred) > 0) {
      filters.push('acne');
  }

  const uniqueFilters = [...new Set(filters)];
  activeFiltersDiv.innerHTML = uniqueFilters.map(filter => 
      `<span class="bxa-filter-tag">${filter}</span>`
  ).join('');

  // 2. Setup Priority and Limits
  const premiumTag = 'beautyxia_premium';
  const limit = maxProductsLimit === 'all' ? Infinity : parseInt(maxProductsLimit, 10);
  const container = document.getElementById('recommended-products');

  // Convert NodeList to Array so we can sort them
  const productsArray = Array.from(productItems);

  // 3. Map products to their relevance and premium status
  const processedProducts = productsArray.map(item => {
      const productTagsStr = item.dataset.tags.toLowerCase();
      const productTagsArray = productTagsStr.split(',').map(t => t.trim());
      const productTitle = item.dataset.title.toLowerCase();

      // Check which analysis filters match this product
      const matchedFilters = uniqueFilters.filter(filter => 
      productTagsArray.includes(filter) || productTitle.includes(filter)
      );

      return {
      element: item,
      isRelevant: matchedFilters.length > 0,
      isPremium: productTagsArray.includes(premiumTag),
      matchedFilters: matchedFilters
      };
  });

  // 4. Sort: Premium items move to the top
  processedProducts.sort((a, b) => {
      if (a.isPremium && !b.isPremium) return -1;
      if (!a.isPremium && b.isPremium) return 1;
      return 0;
  });

  // 5. Display and physically re-order elements
  let visibleCount = 0;

  processedProducts.forEach(product => {
      const item = product.element;

      if (product.isRelevant && visibleCount < limit) {
      item.style.display = 'block';
      visibleCount++;

      // Inject only the matched filters into the tags UI
      const tagsContainer = item.querySelector('.bxa-product-tags');
      if (tagsContainer) {
          tagsContainer.innerHTML = product.matchedFilters
          .slice(0, 3) 
          .map(tag => `<span class="bxa-tag">${tag}</span>`)
          .join('');
      }

      // Re-append to the container to move Premium items to the top visually
      container.appendChild(item);
      } else {
      item.style.display = 'none';
      }
  });

  // 6. Final UI check
  if (visibleCount === 0) {
      noProductsDiv.style.display = 'block';
  } else {
      noProductsDiv.style.display = 'none';
  }

  productRecommendations.style.display = 'block';
  }


// Added actual backend submission for feedback
function initializeFeedbackHandlers() {
  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');

  if (likeBtn) {
    likeBtn.addEventListener('click', function() {
      submitFeedback('like', '');
    });
  }

  if (dislikeBtn) {
    dislikeBtn.addEventListener('click', function() {
      submitFeedback('dislike', 'empty');
    });
  }
}

// New function to submit feedback to Django backend
function submitFeedback(feedbackType, dislikeReason = '') {
  const feedbackEndpoint = 'https://glutton-snowboard-detoxify.ngrok-free.dev/submit-feedback/';
  const payload = {
    feedback_type: feedbackType,
    dislike_reason: dislikeReason
  };
  console.log('Submitting feedback:', payload);

  fetch(feedbackEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Feedback response:', data);
    // Get thank you message from data attribute
    const feedbackSection = document.getElementById('feedbackSection');
    const thankYouMsg = feedbackSection ? feedbackSection.dataset.msgThanks : 'Thank you for your feedback!';
    showFeedbackMessage(thankYouMsg, 'success');
    disableFeedbackButtons();
  })
  .catch(error => {
    console.error('Feedback submission error:', error);
    // Get error message from data attribute
    const feedbackSection = document.getElementById('feedbackSection');
    const errorMsg = feedbackSection ? feedbackSection.dataset.msgError : 'Failed to submit feedback. Please try again.';
    showFeedbackMessage(errorMsg, 'error');
  });
}

function showFeedbackMessage(message, type) {
  const feedbackMessage = document.getElementById('feedbackMessage');
  if (feedbackMessage) {
    feedbackMessage.textContent = message;
    feedbackMessage.className = 'bxa-feedback-message feedback-' + type;
    feedbackMessage.style.display = 'block';
  }
}

function disableFeedbackButtons() {
  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');
  if (likeBtn) likeBtn.disabled = true;
  if (dislikeBtn) dislikeBtn.disabled = true;
}

function resetFeedbackSection() {
  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');
  const feedbackMessage = document.getElementById('feedbackMessage');
  if (likeBtn) likeBtn.disabled = false;
  if (dislikeBtn) dislikeBtn.disabled = false;
  if (feedbackMessage) feedbackMessage.style.display = 'none';
}