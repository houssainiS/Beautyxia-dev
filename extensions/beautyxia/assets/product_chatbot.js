document.addEventListener('DOMContentLoaded', () => {
    
    // UI Elements
    const modal = document.getElementById('product-chatbot-modal');
    const closeBtn = document.getElementById('close-chatbot-btn');
    const titleElement = document.getElementById('chatbot-product-title');
    const messagesContainer = document.getElementById('chatbot-messages');
    const inputField = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send-btn');
    
    // State variables
    let currentProductTitle = '';
    let currentProductDescription = '';
    let currentProductUrl = '';
    let currentProductVariantId = '';
    let chatHistory = [];
    let isTyping = false;

    // Use event delegation for product buttons (since they might be shown/hidden/re-ordered dynamically)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.bxa-product-chat-btn');
        if (btn) {
            currentProductTitle = btn.getAttribute('data-product-title');
            currentProductDescription = btn.getAttribute('data-product-description');
            currentProductUrl = btn.getAttribute('data-product-url');
            currentProductVariantId = btn.getAttribute('data-product-variant-id');
            openChatModal(currentProductTitle);
        }
    });

    closeBtn.addEventListener('click', closeChatModal);
    
    // Close if clicking outside the modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeChatModal();
    });

    sendBtn.addEventListener('click', handleSendMessage);
    inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    function openChatModal(productName) {
        titleElement.textContent = productName;
        chatHistory = []; // Reset history for new product
        messagesContainer.innerHTML = ''; // Clear chat window
        
        // Add a typing indicator element to the container
        const typingDiv = document.createElement('div');
        typingDiv.id = 'chatbot-typing-indicator';
        typingDiv.className = 'bxa-typing-indicator';
        typingDiv.textContent = 'Product is typing...';
        
        modal.style.display = 'flex';

        // Build greeting from translated template (falls back to English)
        const greetingTemplate = (window.BeautyxiaConfig && window.BeautyxiaConfig.chatbotI18n && window.BeautyxiaConfig.chatbotI18n.greeting) || "Hi! I'm {productName}. How can I help you today?";
        const greeting = greetingTemplate.replace('{productName}', productName);
        addMessageToUI('bot', greeting);
        messagesContainer.appendChild(typingDiv); // Keep typing indicator at the bottom
    }

    function closeChatModal() {
        modal.style.display = 'none';
    }

    async function handleSendMessage() {
        const messageText = inputField.value.trim();
        if (!messageText || isTyping) return;

        // 1. Show user message
        addMessageToUI('user', messageText);
        inputField.value = '';
        
        // 2. Save to history
        chatHistory.push({ role: 'user', content: messageText });

        // 3. Prepare data for backend
        // 'lastAnalysisData' is a global variable from your main.js! 
        // We can safely grab it to give the AI context about the user's face.
        const requestData = {
            product_title: currentProductTitle,
            product_description: currentProductDescription,
            language: document.documentElement.lang || 'en', // Gets current shop language
            message: messageText,
            history: chatHistory,
            user_context: window.lastAnalysisData ? {
                skin_type: window.lastAnalysisData.skin_type,
                acne_level: window.lastAnalysisData.acne_pred,
                // Add any other context you want the AI to know
            } : null
        };

        // 4. Show typing indicator
        setTyping(true);

        try {
            // REPLACE THIS URL with your actual Django backend endpoint later
            const response = await fetch('https://glutton-snowboard-detoxify.ngrok-free.dev/product-chat/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
            });

            // ==========================================
            // BEAUTYXIA BILLING
            // 403 = the store's plan doesn't include the chatbot. Show the
            // server's message instead of the generic "couldn't connect" one.
            // ==========================================
            if (response.status === 403) {
                let planMessage = "The chatbot isn't available on this store right now.";
                try {
                    const blocked = await response.json();
                    if (blocked && blocked.error) planMessage = blocked.error;
                } catch (e) { /* keep default message */ }
                addMessageToUI('bot', planMessage);
                return; // the finally block below still turns the typing indicator off
            }

            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            const botReply = data.reply || "Sorry, I'm having trouble thinking right now!";

            // 5. Show bot response and save to history
            addMessageToUI('bot', botReply);
            chatHistory.push({ role: 'assistant', content: botReply });

        } catch (error) {
            console.error('Chatbot Error:', error);
            addMessageToUI('bot', "Sorry, I couldn't connect to my brain right now. Try again later!");
        } finally {
            setTyping(false);
        }
    }

    function addMessageToUI(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `bxa-message bxa-msg-${sender}`;
        msgDiv.textContent = text;

        if (sender === 'bot') {
            // Remove action buttons from all previous bot messages so they only appear on the latest one
            messagesContainer.querySelectorAll('.bxa-chatbot-action-btns').forEach(el => el.remove());

            const addToCartLabel = (window.BeautyxiaConfig && window.BeautyxiaConfig.chatbotI18n && window.BeautyxiaConfig.chatbotI18n.addToCart) || 'Add to Cart';
            const viewProductLabel = (window.BeautyxiaConfig && window.BeautyxiaConfig.chatbotI18n && window.BeautyxiaConfig.chatbotI18n.viewProduct) || 'View Product';

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'bxa-chatbot-action-btns';

            const addToCartBtn = document.createElement('button');
            addToCartBtn.type = 'button';
            addToCartBtn.className = 'bxa-chatbot-action-btn bxa-chatbot-action-btn--cart';
            addToCartBtn.textContent = addToCartLabel;
            addToCartBtn.addEventListener('click', async () => {
                if (!currentProductVariantId) return;
                addToCartBtn.textContent = '...';
                addToCartBtn.disabled = true;
                try {
                    const res = await fetch('/cart/add.js', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: Number(currentProductVariantId), quantity: 1 }),
                    });
                    if (!res.ok) throw new Error('Cart add failed');
                    addToCartBtn.textContent = '✓ ' + addToCartLabel;
                    addToCartBtn.classList.add('bxa-chatbot-action-btn--success');
                } catch {
                    addToCartBtn.textContent = addToCartLabel;
                    addToCartBtn.disabled = false;
                }
            });

            const viewProductLink = document.createElement('a');
            viewProductLink.className = 'bxa-chatbot-action-btn bxa-chatbot-action-btn--view';
            viewProductLink.textContent = viewProductLabel;
            viewProductLink.href = currentProductUrl || '#';

            actionsDiv.appendChild(addToCartBtn);
            actionsDiv.appendChild(viewProductLink);
            msgDiv.appendChild(actionsDiv);
        }
        
        // Insert before the typing indicator
        const typingIndicator = document.getElementById('chatbot-typing-indicator');
        if (typingIndicator) {
            messagesContainer.insertBefore(msgDiv, typingIndicator);
        } else {
            messagesContainer.appendChild(msgDiv);
        }
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function setTyping(status) {
        isTyping = status;
        const indicator = document.getElementById('chatbot-typing-indicator');
        if (indicator) {
            indicator.style.display = status ? 'block' : 'none';
            if (status) messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
});