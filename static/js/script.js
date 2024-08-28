const ChatApp = (function () {
  let isLoggedIn = false;
  let isListening = false;
  let isAITalking = false;
  let isLoading = false;
  let isAutoMicOn = false;
  let currentAudio = null;
  let recognition = null;
  let messageCount = 0;
  let sessionStartTime = null;
  let isTranslating = false;
  let isAnalyzing = false;
  let pendingMessage = null;
  let messageQueue = [];
  let vocabulary = [];

  const elements = {
    chatContainer: document.getElementById("chat-container"),
    userInput: document.getElementById("user-input"),
    sendBtn: document.getElementById("send-btn"),
    voiceBtn: document.getElementById("voice-btn"),
    autoMicToggle: document.getElementById("auto-mic-toggle"),
    authModal: document.getElementById("auth-modal"),
    loginBtn: document.getElementById("login-btn"),
    signupBtn: document.getElementById("signup-btn"),
    authMessage: document.getElementById("auth-message"),
    modalTitle: document.getElementById("modal-title"),
    loginForm: document.getElementById("login-form"),
    signupForm: document.getElementById("signup-form"),
    showSignupLink: document.getElementById("show-signup"),
    showLoginLink: document.getElementById("show-login"),
    menuIcon: document.getElementById("menu-icon"),
    sidebar: document.getElementById("sidebar"),
    closeSidebar: document.getElementById("close-sidebar"),
    userId: document.getElementById("user-id"),
    showForgotPasswordLink: document.getElementById("show-forgot-password"),
    forgotPasswordForm: document.getElementById("forgot-password-form"),
    backToLoginLink: document.getElementById("back-to-login"),
    resetPasswordBtn: document.getElementById("reset-password-btn"),
    logoutBtn: document.getElementById("logout-btn"),
    showTodaysNews: document.getElementById("show-todays-news"),
    showReports: document.getElementById("show-reports"),
    reportsModal: document.getElementById("reports-modal"),
    reportsContainer: document.getElementById("reports-container"),
    showVocabulary: document.getElementById("show-vocabulary"),
    vocabularyModal: document.getElementById("vocabulary-modal"),
    vocabularyContainer: document.getElementById("vocabulary-container"),
    vocabularyDateSelect: document.getElementById("vocabulary-date-select"),
  };

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  function init() {
    if (!elements.chatContainer) {
      console.error("Critical element is missing. Chat container not found.");
      return;
    }
    setupEventListeners();
    setupSpeechRecognition();
    checkLoginStatus();
    setupVocabularyEventListeners();
  }

  function setupVocabularyEventListeners() {
    elements.showVocabulary?.addEventListener("click", showVocabularyModal);
    elements.vocabularyModal
      .querySelector(".close")
      ?.addEventListener("click", closeVocabularyModal);
  }

  function setupEventListeners() {
    elements.sendBtn?.addEventListener("click", sendMessage);
    elements.userInput?.addEventListener("keypress", handleKeyPress);
    elements.voiceBtn?.addEventListener("click", toggleVoiceRecognition);
    elements.autoMicToggle?.addEventListener("click", toggleAutoMic);
    elements.loginBtn?.addEventListener("click", login);
    elements.signupBtn?.addEventListener("click", signup);
    elements.showSignupLink?.addEventListener("click", showSignupForm);
    elements.showLoginLink?.addEventListener("click", showLoginForm);
    elements.menuIcon?.addEventListener("click", openSidebar);
    elements.closeSidebar?.addEventListener("click", closeSidebar);

    elements.showForgotPasswordLink?.addEventListener(
      "click",
      showForgotPasswordForm
    );
    elements.backToLoginLink?.addEventListener("click", backToLogin);
    elements.resetPasswordBtn?.addEventListener("click", resetPassword);
    elements.logoutBtn?.addEventListener("click", logout);
    elements.showTodaysNews?.addEventListener("click", showTodaysNews);
    elements.showReports?.addEventListener("click", showReportsModal);
    elements.reportsModal
      .querySelector(".close")
      ?.addEventListener("click", closeReportsModal);
  }

  function sendMessage(event) {
    if (event && event.preventDefault) {
      event.preventDefault();
    }

    const message = elements.userInput.value.trim();
    if (message) {
      if (isProcessing()) {
        pendingMessage = message;
        showPendingMessageNotification();
      } else {
        messageQueue.push(message);
        processMessageQueue();
        messageCount++;
      }
      elements.userInput.value = "";
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  }

  function processMessageQueue() {
    if (isProcessing() || messageQueue.length === 0) {
      return;
    }

    setProcessing(true);
    const message = messageQueue.shift();
    addMessage(message, true);

    const loadingDiv = addLoadingAnimation();
    setLoading(true);
    setAITalking(true);
    stopListening();

    sendMessageToServer(message)
      .then((data) => {
        if (data.success) {
          addMessage(data.message, false, data.audio);
        } else {
          throw new Error("서버에서 오류 응답을 받았습니다.");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        addMessage("네트워크 오류가 발생했습니다. 다시 시도해 주세요.", false);
      })
      .finally(() => {
        removeLoadingAnimation(loadingDiv);
        setLoading(false);
        setAITalking(false);
        setProcessing(false);
        if (pendingMessage) {
          showPendingMessageConfirmation();
        } else {
          processMessageQueue();
        }
        if (isAutoMicOn && !isAITalking) {
          startListening();
        }
      });
  }

  function sendMessageToServer(message) {
    return fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message }),
    }).then((response) => {
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    });
  }

  function addMessage(message, isUser, audioData) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;

    const messageBubble = document.createElement("div");
    messageBubble.className = "message-bubble";
    messageBubble.textContent = message;
    messageDiv.appendChild(messageBubble);

    if (isUser) {
      const analyzeBtn = document.createElement("button");
      analyzeBtn.className = "analyze-btn";
      analyzeBtn.textContent = "분석";
      analyzeBtn.onclick = () => analyzeKorean(message, messageDiv);
      messageDiv.appendChild(analyzeBtn);
    } else {
      const translateBtn = document.createElement("button");
      translateBtn.className = "translate-btn";
      translateBtn.textContent = "번역";
      translateBtn.onclick = () =>
        translateMessage(message, messageDiv, translateBtn);
      messageDiv.appendChild(translateBtn);

      addWordHoverEffects(messageBubble);
    }

    elements.chatContainer.appendChild(messageDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

    if (!isUser && audioData) {
      playAudio(audioData);
    }
  }

  function addWordHoverEffects(element) {
    const words = element.textContent.split(/\s+/);
    element.innerHTML = words
      .map((word) => `<span class="hoverable-word">${word}</span>`)
      .join(" ");

    element.querySelectorAll(".hoverable-word").forEach((span) => {
      span.addEventListener("mouseenter", showWordMeaning);
      span.addEventListener("mouseleave", hideWordMeaning);
      span.addEventListener("click", handleWordClick);
    });
  }

  function handleWordClick(event) {
    event.preventDefault();
    const word = event.target.textContent;
    const tooltip = document.querySelector(".word-tooltip");
    if (tooltip) {
      const meaning = tooltip
        .querySelector("p:nth-child(2)")
        .textContent.split(":")[1]
        .trim();
      const explanation = tooltip
        .querySelector("p:nth-child(3)")
        .textContent.split(":")[1]
        .trim();
      saveWordToVocabulary(word, meaning, explanation);
    } else {
      console.log("Tooltip not found. Fetching word meaning...");
      fetchWordMeaning(word);
    }
  }

  function fetchWordMeaning(word) {
    fetch("/get_word_meaning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: word }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.meaning) {
          saveWordToVocabulary(word, data.meaning, data.explanation);
        } else {
          throw new Error("Meaning not found in the response");
        }
      })
      .catch((error) => {
        console.error("Error fetching word meaning:", error);
        alert("단어 의미를 가져오는 데 실패했습니다. 다시 시도해 주세요.");
      });
  }

  function fetchWordMeaning(element, word) {
    fetch("/get_word_meaning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: word }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.meaning) {
          saveWordToVocabulary(element, word, data.meaning, data.explanation);
        } else {
          throw new Error("Meaning not found in the response");
        }
      })
      .catch((error) => {
        console.error("Error fetching word meaning:", error);
        alert("단어 의미를 가져오는 데 실패했습니다. 다시 시도해 주세요.");
      });
  }

  const showWordMeaning = debounce((event) => {
    const word = event.target.textContent;
    console.log(`Requesting meaning for word: ${word}`);

    // 기존 툴팁 제거
    hideWordMeaning();

    let tooltip = document.createElement("div");
    tooltip.className = "word-tooltip";
    tooltip.textContent = "Loading...";
    document.body.appendChild(tooltip);

    // 툴팁 위치 조정
    const rect = event.target.getBoundingClientRect();
    const tooltipWidth = 300;
    const tooltipHeight = 200;

    let left = rect.left;
    let top = rect.bottom + window.scrollY;

    // 오른쪽 경계 체크
    if (left + tooltipWidth > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - 10;
    }

    // 아래쪽 경계 체크
    if (top + tooltipHeight > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - tooltipHeight - 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    fetch("/get_word_meaning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: word }),
    })
      .then((response) => {
        console.log(`Response status: ${response.status}`);
        if (!response.ok) {
          return response.text().then((text) => {
            console.log(`Error response text: ${text}`);
            throw new Error(`HTTP error! status: ${response.status}`);
          });
        }
        return response.json();
      })
      .then((data) => {
        console.log("Received data:", data);
        if (!data.meaning) {
          throw new Error("Meaning not found in the response");
        }

        // 기존 툴팁이 아직 존재하는지 확인
        if (!document.body.contains(tooltip)) {
          tooltip = document.createElement("div");
          tooltip.className = "word-tooltip";
          document.body.appendChild(tooltip);
        }

        tooltip.innerHTML = `
          <div class="tooltip-content">
            <p><strong>원문:</strong> ${escapeHtml(word)}</p>
            <p><strong>뜻:</strong> ${escapeHtml(data.meaning)}</p>
            <p><strong>설명:</strong> ${escapeHtml(
              data.explanation || "Not available"
            )}</p>
          </div>
        `;

        const saveButton = document.createElement("button");
        saveButton.textContent = "단어장에 저장";
        saveButton.onclick = (e) => {
          e.stopPropagation();
          const wordElement = event.target.closest(".hoverable-word");
          if (wordElement) {
            saveWordToVocabulary(word, data.meaning, data.explanation);
          } else {
            console.error("Could not find the word element");
          }
        };
        tooltip.appendChild(saveButton);

        // 툴팁에 마우스 진입 시 사라지지 않도록 설정
        tooltip.addEventListener("mouseenter", () => {
          clearTimeout(tooltip.hideTimeout);
        });
        tooltip.addEventListener("mouseleave", () => {
          hideWordMeaning();
        });
      })
      .catch((error) => {
        console.error("Error fetching word meaning:", error);
        tooltip.textContent = `Error loading meaning: ${error.message}`;
      });
  }, 300);

  function hideWordMeaning() {
    const tooltip = document.querySelector(".word-tooltip");
    if (tooltip && tooltip.parentNode) {
      tooltip.hideTimeout = setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      }, 300); // 300ms 지연
    }
  }

  function saveWordToVocabulary(word, meaning, explanation) {
    console.log(
      `Attempting to save word: ${word}, meaning: ${meaning}, explanation: ${explanation}`
    );
    if (!word || !meaning) {
      console.error("Word or meaning is missing");
      alert("단어와 의미를 모두 입력해주세요.");
      return;
    }

    fetch("/save_vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, meaning, explanation: explanation || "" }),
    })
      .then((response) => {
        console.log(`Save vocabulary response status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        console.log("Save vocabulary response data:", data);
        if (data.success) {
          console.log("Word saved to vocabulary");
          const savedWordElement = findWordElement(word);
          if (savedWordElement) {
            savedWordElement.classList.add("saved-word");
          }
          alert("단어가 성공적으로 저장되었습니다.");
        } else {
          throw new Error(data.error || "Failed to save word");
        }
      })
      .catch((error) => {
        console.error("Error saving word to vocabulary:", error);
        alert(`단어 저장 실패: ${error.message}`);
      });
  }

  function findWordElement(word) {
    const words = document.querySelectorAll(".hoverable-word");
    for (let element of words) {
      if (element.textContent.trim() === word) {
        return element;
      }
    }
    return null;
  }
  function showVocabularyModal() {
    fetch("/get_vocabulary")
      .then((response) => {
        if (!response.ok) {
          return response.json().then((err) => {
            throw new Error(
              err.error || `HTTP error! status: ${response.status}`
            );
          });
        }
        return response.json();
      })
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }
        if (!Array.isArray(data.vocabulary)) {
          throw new Error("Invalid vocabulary data");
        }
        groupedVocabulary = groupVocabularyByDate(data.vocabulary);
        populateDateSelector();
        const dates = Object.keys(groupedVocabulary);
        if (dates.length > 0) {
          displayVocabularyForDate(dates[0]);
        } else {
          elements.vocabularyContainer.innerHTML =
            "<p>No vocabulary items found.</p>";
        }
        elements.vocabularyModal.style.display = "block";
      })
      .catch((error) => {
        console.error("Error fetching vocabulary:", error);
        elements.vocabularyContainer.innerHTML = `<p>Error loading vocabulary: ${error.message}</p>`;
        elements.vocabularyModal.style.display = "block";
      });
  }

  function groupVocabularyByDate(vocabulary) {
    if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
      return {};
    }
    return vocabulary.reduce((acc, item) => {
      const date = new Date(item.created_at).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(item);
      return acc;
    }, {});
  }

  function closeVocabularyModal() {
    elements.vocabularyModal.style.display = "none";
  }

  function displayVocabulary() {
    elements.vocabularyContainer.innerHTML = "";
    vocabulary.forEach((item) => {
      const wordElement = document.createElement("div");
      wordElement.className = "vocabulary-item";
      wordElement.innerHTML = `<strong>${item.word}</strong>: ${item.meaning}`;
      elements.vocabularyContainer.appendChild(wordElement);
    });
  }

  function displayVocabularyForDate(date) {
    const vocabularyItems = groupedVocabulary[date];
    elements.vocabularyContainer.innerHTML = "";
    vocabularyItems.forEach((item) => {
      const itemElement = document.createElement("div");
      itemElement.className = "vocabulary-item";
      itemElement.innerHTML = `
            <p><strong>원문:</strong> ${escapeHtml(item.word)}</p>
            <p><strong>뜻:</strong> ${escapeHtml(item.meaning)}</p>
            <p><strong>설명:</strong> ${escapeHtml(
              item.explanation || "설명 없음"
            )}</p>
        `;
      elements.vocabularyContainer.appendChild(itemElement);
    });
  }
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function populateDateSelector() {
    elements.vocabularyDateSelect.innerHTML = "";
    Object.keys(groupedVocabulary).forEach((date) => {
      const option = document.createElement("option");
      option.value = date;
      option.textContent = date;
      elements.vocabularyDateSelect.appendChild(option);
    });
    elements.vocabularyDateSelect.addEventListener("change", (e) => {
      displayVocabularyForDate(e.target.value);
    });
  }

  function playAudio(audioData) {
    setAITalking(true);
    if (isListening) {
      stopListening();
    }
    currentAudio = new Audio("data:audio/mp3;base64," + audioData);
    currentAudio.play().catch((error) => {
      console.error("오디오 재생 오류:", error);
      setAITalking(false);
      if (isAutoMicOn) {
        startListening();
      }
    });
    currentAudio.onended = () => {
      currentAudio = null;
      setAITalking(false);
      if (isAutoMicOn) {
        startListening();
      }
    };
  }

  function setupSpeechRecognition() {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      console.error("음성 인식이 지원되지 않는 브라우저입니다.");
      return;
    }

    recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      console.log("음성 인식이 시작되었습니다.");
      setListening(true);
      elements.voiceBtn.classList.add("active", "voice-active");
    };

    recognition.onend = () => {
      console.log("음성 인식이 종료되었습니다.");
      setListening(false);
      elements.voiceBtn.classList.remove("active", "voice-active");

      if (
        elements.userInput.value.trim() !== "" &&
        elements.userInput.value.trim() !== lastProcessedResult
      ) {
        lastProcessedResult = elements.userInput.value.trim();
        sendMessage(lastProcessedResult, true);
      }

      if (isAutoMicOn && !isAITalking && !isLoading) {
        startListening();
      }
    };

    recognition.onresult = handleSpeechResult;
    recognition.onerror = handleSpeechError;
  }

  function handleSpeechResult(event) {
    let currentTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        currentTranscript += event.results[i][0].transcript + " ";
      }
    }

    elements.userInput.value = currentTranscript.trim();

    if (currentTranscript.trim() !== lastProcessedResult.trim()) {
      if (currentTranscript.trim() !== "") {
        lastProcessedResult = currentTranscript.trim();
        sendMessage(lastProcessedResult, true);
      }
    }
  }

  function handleSpeechError(event) {
    console.error("음성 인식 오류:", event.error);
    stopListening();
    if (isAutoMicOn) {
      setTimeout(startListening, 1000);
    }
  }

  function toggleVoiceRecognition() {
    if (isAITalking || isLoading) {
      stopAITalking();
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function toggleAutoMic() {
    isAutoMicOn = !isAutoMicOn;
    elements.autoMicToggle.textContent = isAutoMicOn
      ? "Auto Mic: ON"
      : "Auto Mic: OFF";
    elements.autoMicToggle.classList.toggle("active");
    if (isAutoMicOn && !isAITalking && !isLoading) {
      startListening();
    } else if (!isAutoMicOn) {
      stopListening();
    }
  }

  function startListening() {
    if (!recognition) {
      setupSpeechRecognition();
    }
    recognition.start();
    setListening(true);
    elements.voiceBtn.classList.add("active");
    console.log("음성 인식이 시작되었습니다.");
  }

  function stopListening() {
    if (recognition) {
      recognition.stop();
      setListening(false);
      elements.voiceBtn.classList.remove("active");
      console.log("음성 인식이 중지되었습니다.");
    }
  }

  function stopAITalking() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    setAITalking(false);
    setLoading(false);
    console.log("AI 발화가 중지되었습니다.");
    if (pendingMessage) {
      showPendingMessageConfirmation();
    }
  }

  function addLoadingAnimation() {
    setLoading(true);
    if (isAutoMicOn) {
      stopListening();
    }
    const messageDiv = document.createElement("div");
    messageDiv.className = "message bot-message";

    const loadingDiv = document.createElement("div");
    loadingDiv.className = "message-bubble loading";
    loadingDiv.innerHTML = `
          <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
          </div>
      `;
    messageDiv.appendChild(loadingDiv);
    elements.chatContainer.appendChild(messageDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
    return messageDiv;
  }

  function removeLoadingAnimation(loadingDiv) {
    elements.chatContainer.removeChild(loadingDiv);
    setLoading(false);
    if (isAutoMicOn && !isAITalking) {
      startListening();
    }
  }

  function translateMessage(message, messageDiv, translateBtn) {
    if (isTranslating) {
      console.log("번역이 이미 진행 중입니다.");
      return;
    }

    const existingTranslation = messageDiv.querySelector(".translation");
    if (existingTranslation) {
      existingTranslation.style.display =
        existingTranslation.style.display === "none" ? "block" : "none";
      return;
    }

    setTranslating(true);
    translateBtn.disabled = true;

    const loadingDiv = addTranslationLoadingAnimation(messageDiv);

    fetch("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data.translation) {
          const translationDiv = document.createElement("div");
          translationDiv.className = "translation";
          translationDiv.textContent = data.translation;
          messageDiv.appendChild(translationDiv);
          translationDiv.style.display = "block";
          elements.chatContainer.scrollTop =
            elements.chatContainer.scrollHeight;
        } else {
          throw new Error("번역 데이터가 없습니다.");
        }
      })
      .catch((error) => {
        console.error("Translation error:", error);
        addMessage("번역 중 오류가 발생했습니다. 다시 시도해 주세요.", false);
        translateBtn.classList.remove("active");
      })
      .finally(() => {
        removeTranslationLoadingAnimation(loadingDiv);
        setTranslating(false);
        translateBtn.disabled = false;
      });
  }

  function addTranslationLoadingAnimation(container) {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "loading-animation";
    loadingDiv.innerHTML = '<div class="boxLoading"></div>';
    container.appendChild(loadingDiv);
    return loadingDiv;
  }

  function removeTranslationLoadingAnimation(loadingDiv) {
    if (loadingDiv && loadingDiv.parentNode) {
      loadingDiv.parentNode.removeChild(loadingDiv);
    }
  }

  function analyzeKorean(message, messageDiv) {
    if (isAnalyzing) {
      console.log("분석이 이미 진행 중입니다.");
      return;
    }

    const existingAnalysis = messageDiv.querySelector(".korean-analysis");
    if (existingAnalysis) {
      existingAnalysis.style.display =
        existingAnalysis.style.display === "none" ? "block" : "none";
      return;
    }

    setAnalyzing(true);

    const loadingDiv = addAnalysisLoadingAnimation(messageDiv);

    fetch("/analyze_korean", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("Received analysis data:", data);
        if (data.error) {
          throw new Error(data.error);
        }
        if (data.errors) {
          displayErrorsAndImprovements(data, messageDiv);
        } else {
          throw new Error("분석 데이터 형식이 올바르지 않습니다.");
        }
      })
      .catch((error) => {
        console.error("Analysis error:", error);
        if (error.message.includes("HTTP error! status: 500")) {
          // 500 에러 발생 시 재시도
          setTimeout(() => analyzeKorean(message, messageDiv), 1000);
        } else {
          messageDiv.querySelector(".korean-analysis").innerHTML =
            "분석 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.";
        }
      })
      .finally(() => {
        removeAnalysisLoadingAnimation(loadingDiv);
        setAnalyzing(false);
      });
  }

  function displayKoreanAnalysis(analysis, container, isFullReport = false) {
    const analysisDiv = document.createElement("div");
    analysisDiv.className = "korean-analysis";

    const sections = [
      {
        title: "Errors and Improvements",
        content: formatErrorsAndImprovements(analysis.errors),
        class: "errors",
      },
      {
        title: "Final Revised Version",
        content: analysis.final_revised,
        class: "final-revised",
      },
      {
        title: "Overall Comment",
        content: analysis.overall_comment,
        class: "overall-comment",
      },
    ];

    sections.forEach((section) => {
      const sectionDiv = document.createElement("div");
      sectionDiv.className = `analysis-section ${section.class}`;

      const title = document.createElement("h3");
      title.textContent = section.title;
      sectionDiv.appendChild(title);

      const content = document.createElement("div");
      content.className = "section-content";
      content.innerHTML = section.content;
      sectionDiv.appendChild(content);

      analysisDiv.appendChild(sectionDiv);
    });

    container.appendChild(analysisDiv);
  }

  function formatErrorsAndImprovements(errors) {
    return errors
      .map(
        (error, index) => `
        <div class="error-item">
            <div class="error-type">${index + 1}. ${error.type}</div>
            <div class="incorrect">Incorrect: ${error.incorrect}</div>
            <div class="improved">Improved: ${error.improved}</div>
            <div class="explanation">Explanation: ${error.explanation}</div>
        </div>
    `
      )
      .join("");
  }

  function addAnalysisLoadingAnimation(container) {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "loading-animation";
    loadingDiv.innerHTML = '<div class="boxLoading"></div>';
    container.appendChild(loadingDiv);
    return loadingDiv;
  }

  function removeAnalysisLoadingAnimation(loadingDiv) {
    if (loadingDiv && loadingDiv.parentNode) {
      loadingDiv.parentNode.removeChild(loadingDiv);
    }
  }

  function login() {
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;

    fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setLoggedIn(true);
          elements.authModal.style.display = "none";
          updateUserId(username);
          sessionStartTime = new Date();
          startUsageTracking();
        } else {
          setMessage("Failed to log in. Please try again.", "error");
        }
      })
      .catch((error) => {
        console.error("Login error:", error);
        setMessage(
          "An error occurred while logging in. Please try again.",
          "error"
        );
      });
  }

  function signup() {
    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    if (!username || !email || !password) {
      setMessage("Please fill in all fields.", "error");
      return;
    }

    if (!isValidEmail(email)) {
      setMessage("Please enter a valid email address.", "error");
      return;
    }

    if (password.length < 4) {
      setMessage("Password must be at least 4 characters long.", "error");
      return;
    }

    fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username,
        email: email,
        password: password,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setMessage("Sign up successful. Please log in.", "success");
          showLoginForm();
        } else if (data.error === "username_taken") {
          setMessage(
            "Username is already taken. Please choose another.",
            "error"
          );
        } else {
          setMessage(
            "Email is already registered. Do you already have an account?",
            "error"
          );
        }
      })
      .catch((error) => {
        console.error("Signup error:", error);
        setMessage(
          "An error occurred during sign up. Please try again.",
          "error"
        );
      });
  }

  function isValidEmail(email) {
    const re =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  function startUsageTracking() {
    setInterval(() => {
      const currentTime = new Date();
      const usageTime = Math.floor((currentTime - sessionStartTime) / 1000);
      updateUsageTime(usageTime);
    }, 60000);
  }

  function updateUsageTime(time) {
    fetch("/update_usage_time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time: time }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) {
          console.error("사용 시간 업데이트 실패");
        }
      })
      .catch((error) => {
        console.error("Usage time update error:", error);
      });
  }

  function checkLoginStatus() {
    fetch("/check_login")
      .then((response) => response.json())
      .then((data) => {
        if (data.logged_in) {
          setLoggedIn(true);
          updateUserId(data.username);
          elements.authModal.style.display = "none";
        } else {
          showLoginForm();
        }
      })
      .catch((error) => {
        console.error("로그인 상태 확인 오류:", error);
        showLoginForm();
      });
  }

  function logout() {
    fetch("/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setLoggedIn(false);
          showLoginForm();
          closeSidebar();
        }
      })
      .catch((error) => console.error("Logout error:", error));
  }

  function updateUserId(username) {
    elements.userId.textContent = username;
  }

  function setMessage(message, type) {
    elements.authMessage.textContent = message;
    elements.authMessage.className = type ? type + "-message" : "";
  }

  function showLoginForm() {
    clearAuthMessage();
    elements.modalTitle.textContent = "Login";
    elements.loginForm.style.display = "block";
    elements.signupForm.style.display = "none";
    elements.forgotPasswordForm.style.display = "none";
    elements.authModal.style.display = "block";
  }

  function showSignupForm(e) {
    e.preventDefault();
    clearAuthMessage();
    elements.modalTitle.textContent = "Sign Up";
    elements.loginForm.style.display = "none";
    elements.signupForm.style.display = "block";
    elements.forgotPasswordForm.style.display = "none";
  }

  function showForgotPasswordForm(e) {
    e.preventDefault();
    clearAuthMessage();
    elements.loginForm.style.display = "none";
    elements.signupForm.style.display = "none";
    elements.forgotPasswordForm.style.display = "block";
    elements.modalTitle.textContent = "Reset Password";
  }

  function backToLogin(e) {
    e.preventDefault();
    clearAuthMessage();
    showLoginForm();
  }

  function resetPassword() {
    const email = document.getElementById("reset-email").value;
    const loadingAnimation = document.getElementById("loading-animation");

    if (!isValidEmail(email)) {
      setMessage("Please enter a valid email address.", "error");
      return;
    }

    loadingAnimation.style.display = "block";
    elements.resetPasswordBtn.disabled = true;
    clearAuthMessage();

    fetch("/request_reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    })
      .then((response) => response.json())
      .then((data) => {
        setMessage(
          data.message,
          data.message === "Reset link sent to your email" ? "success" : "error"
        );
      })
      .catch((error) => {
        console.error("Error:", error);
        setMessage("An error occurred. Please try again.", "error");
      })
      .finally(() => {
        loadingAnimation.style.display = "none";
        elements.resetPasswordBtn.disabled = false;
      });
  }

  function clearAuthMessage() {
    elements.authMessage.textContent = "";
    elements.authMessage.className = "";
  }

  function openSidebar() {
    elements.sidebar.style.width = "50%";
  }

  function closeSidebar() {
    elements.sidebar.style.width = "0";
  }

  function showTodaysNews() {
    fetch("/get_news")
      .then((response) => response.json())
      .then((data) => {
        data.messages.forEach((message) => {
          addMessage(message, false);
        });
      })
      .catch((error) => {
        console.error("Error fetching news:", error);
        addMessage("뉴스를 가져오는 중 오류가 발생했습니다.", false);
      });
  }

  function setLoggedIn(value) {
    isLoggedIn = value;
  }

  function setListening(value) {
    isListening = value;
  }

  function setAITalking(value) {
    isAITalking = value;
  }

  function setLoading(value) {
    isLoading = value;
  }

  function setTranslating(value) {
    isTranslating = value;
  }

  function setAnalyzing(value) {
    isAnalyzing = value;
  }

  function isProcessing() {
    return isLoading || isAITalking;
  }

  function setProcessing(value) {
    isLoading = value;
    isAITalking = value;
  }

  // function showPendingMessageNotification() {
  //   const notification = document.createElement("div");
  //   notification.id = "pending-message-notification";
  //   notification.textContent = "대기 중인 메시지가 있습니다";
  //   notification.style.display = "block";
  //   document.body.appendChild(notification);
  // }

  function showReportsModal() {
    elements.reportsModal.style.display = "block";
    loadReports();
  }

  function closeReportsModal() {
    elements.reportsModal.style.display = "none";
  }

  function loadReports() {
    fetch("/get_reports")
      .then((response) => response.json())
      .then((reports) => {
        const groupedReports = groupReportsByDate(reports);
        createDateSelector(groupedReports);
        const firstDate = Object.keys(groupedReports)[0];
        displayReportsForDate(firstDate, groupedReports);
      })
      .catch((error) => {
        console.error("Error loading reports:", error);
        elements.reportsContainer.innerHTML =
          "Error loading reports. Please try again.";
      });
  }

  function createDateSelector(groupedReports) {
    const dateSelect = document.getElementById("date-select");
    dateSelect.innerHTML = "";

    Object.keys(groupedReports)
      .sort()
      .reverse()
      .forEach((date) => {
        const option = document.createElement("option");
        option.value = date;
        option.textContent = date;
        dateSelect.appendChild(option);
      });

    dateSelect.onchange = (e) =>
      displayReportsForDate(e.target.value, groupedReports);
  }

  function groupReportsByDate(reports) {
    const grouped = {};
    reports.forEach((report) => {
      const date = report.created_at.split(" ")[0]; // Extract date part
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(report);
    });
    return grouped;
  }

  function displayReportsForDate(date, groupedReports) {
    elements.reportsContainer.innerHTML = "";

    const dateGroup = document.createElement("div");
    dateGroup.className = "report-date-group";

    groupedReports[date].forEach((report) => {
      const reportElement = createReportElement(report);
      dateGroup.appendChild(reportElement);
    });

    elements.reportsContainer.appendChild(dateGroup);
  }

  function createReportElement(report) {
    const element = document.createElement("div");
    element.className = "report";
    element.innerHTML = `
      <p><strong>Original:</strong> ${escapeHtml(report.original_text)}</p>
      <p><strong>Final Revised Version:</strong> ${escapeHtml(
        report.analysis.final_revised || "Not available"
      )}</p>
      <button onclick="ChatApp.showAnalysis(this, ${
        report.id
      })">View Analysis</button>
      <div class="analysis-container" style="display: none;"></div>
    `;
    return element;
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showAnalysis(button, reportId) {
    const container = button.nextElementSibling;
    if (container.style.display === "none") {
      fetchAnalysis(reportId, container, button, 3); // 3 attempts
    } else {
      container.style.display = "none";
      button.textContent = "View Analysis";
    }
  }

  function fetchAnalysis(reportId, container, button, attemptsLeft) {
    fetch(`/get_analysis/${reportId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((analysis) => {
        container.style.display = "block";
        container.innerHTML = "";
        displayFullAnalysis(analysis, container);
        button.textContent = "Hide Analysis";
      })
      .catch((error) => {
        console.error("Error loading analysis data:", error);
        if (attemptsLeft > 0) {
          console.log(`Retrying... ${attemptsLeft} attempts left`);
          setTimeout(
            () => fetchAnalysis(reportId, container, button, attemptsLeft - 1),
            1000
          );
        } else {
          container.innerHTML =
            "Unable to load analysis at this time. Please try again later.";
        }
      });
  }
  function displayErrorsAndImprovements(data, container) {
    const analysisDiv = document.createElement("div");
    analysisDiv.className = "korean-analysis";

    const errorsSection = document.createElement("div");
    errorsSection.className = "analysis-section errors";

    const title = document.createElement("h3");
    title.textContent = "Errors and Improvements";
    errorsSection.appendChild(title);

    const content = document.createElement("div");
    content.className = "section-content";
    content.innerHTML = formatErrorsAndImprovements(data.errors);
    errorsSection.appendChild(content);

    analysisDiv.appendChild(errorsSection);
    container.appendChild(analysisDiv);
  }

  function displayFullAnalysis(analysis, container) {
    const analysisDiv = document.createElement("div");
    analysisDiv.className = "korean-analysis";

    const sections = [
      {
        title: "Errors and Improvements",
        content: formatErrorsAndImprovements(analysis.errors),
        class: "errors",
      },
      {
        title: "Final Revised Version",
        content: analysis.final_revised,
        class: "final-revised",
      },
      {
        title: "Overall Comment",
        content: analysis.overall_comment,
        class: "overall-comment",
      },
    ];

    sections.forEach((section) => {
      const sectionDiv = document.createElement("div");
      sectionDiv.className = `analysis-section ${section.class}`;

      const title = document.createElement("h3");
      title.textContent = section.title;
      sectionDiv.appendChild(title);

      const content = document.createElement("div");
      content.className = "section-content";
      content.innerHTML = section.content;
      sectionDiv.appendChild(content);

      analysisDiv.appendChild(sectionDiv);
    });

    container.appendChild(analysisDiv);
  }

  return {
    init: init,
    sendMessage: sendMessage,
    toggleVoiceRecognition: toggleVoiceRecognition,
    toggleAutoMic: toggleAutoMic,
    login: login,
    signup: signup,
    logout: logout,
    showLoginForm: showLoginForm,
    showSignupForm: showSignupForm,
    showForgotPasswordForm: showForgotPasswordForm,
    resetPassword: resetPassword,
    showTodaysNews: showTodaysNews,
    showReportsModal: showReportsModal,
    showAnalysis: showAnalysis,
    showVocabularyModal: showVocabularyModal,
  };
})();

document.addEventListener("DOMContentLoaded", ChatApp.init);
