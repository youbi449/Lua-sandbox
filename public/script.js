document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const executeBtn = document.getElementById('execute-btn');
    const outputText = document.getElementById('output-text');
    const errorText = document.getElementById('error-text');
    const charCount = document.getElementById('char-count');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const showFunctionsBtn = document.getElementById('show-functions-btn');
    const allowedFunctionsDiv = document.getElementById('allowed-functions');
    const functionsList = document.getElementById('functions-list');

    // 
    codeInput.addEventListener('input', () => {
        const count = codeInput.value.length;
        charCount.textContent = count;
        
        if (count > 1000) {
            charCount.style.color = 'var(--error)';
        } else {
            charCount.style.color = 'var(--text-secondary)';
        }
    });

    // Tab management
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabName) {
                    content.classList.add('active');
                }
            });
        });
    });

    // Loading allowed functions
    async function loadAllowedFunctions() {
        try {
            const response = await fetch('/allowed-functions');
            const functions = await response.json();
            
            functionsList.innerHTML = Object.entries(functions)
                .map(([library, funcs]) => `
                    <div class="library-section">
                        <h3>${library}</h3>
                        <ul>
                            ${funcs.map(func => `<li>${library}.${func}</li>`).join('')}
                        </ul>
                    </div>
                `).join('');
        } catch (error) {
            console.error('Error loading functions:', error);
        }
    }

    // Show/hide allowed functions
    showFunctionsBtn.addEventListener('click', () => {
        allowedFunctionsDiv.classList.toggle('hidden');
        if (!allowedFunctionsDiv.classList.contains('hidden')) {
            loadAllowedFunctions();
        }
    });

    // Execute code
    executeBtn.addEventListener('click', async () => {
        const code = codeInput.value;

        if (code.length > 1000) {
            errorText.textContent = 'The code exceeds the 1000 character limit';
            document.querySelector('[data-tab="errors"]').click();
            return;
        }

        try {
            executeBtn.disabled = true;
            executeBtn.textContent = 'Executing...';

            console.log('Sending code:', code);
            const payload = { code };
            console.log('Payload:', payload);

            const response = await fetch('/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            console.log('Status:', response.status);
            const data = await response.json();
            console.log('Response:', data);

            if (data.error) {
                errorText.textContent = data.error;
                document.querySelector('[data-tab="errors"]').click();
            } else {
                outputText.textContent = data.output || 'No output';
                errorText.textContent = '';
                document.querySelector('[data-tab="output"]').click();
            }
        } catch (error) {
            errorText.textContent = 'Server connection error';
            document.querySelector('[data-tab="errors"]').click();
        } finally {
            executeBtn.disabled = false;
            executeBtn.textContent = 'Execute';
        }
    });
}); 