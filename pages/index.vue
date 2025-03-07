<script setup lang="ts">
type str = string;
const id = ref<null | str>(null);
const link = ref("");

function generateChat() {
    id.value = randomGameId(8);
    link.value = `${window.location.origin}/chat-${id.value}`;
}

function copyLink() {
    navigator.clipboard.writeText(link.value);
    showCopiedTooltip();
}

// Add copied tooltip functionality
const copied = ref(false);
function showCopiedTooltip() {
    copied.value = true;
    setTimeout(() => {
        copied.value = false;
    }, 2000);
}
</script>

<template>
    <div class="link-container">
        <h1 class="title">Share Your Chat Room</h1>
        <div class="input-group">
            <input
                :readonly="true"
                :value="link"
                class="link-input"
                placeholder="Click 'Generate Chat' to create a new chat room"
                aria-label="Chat room link"
            />
            <button
                @click="copyLink"
                class="copy-button"
                aria-label="Copy link"
                :disabled="!link"
            >
                <Icon name="custom:clipboard" class="clipboard-icon"></Icon>
                <span class="tooltip" :class="{ 'tooltip-visible': copied }"
                    >Copied!</span
                >
            </button>
        </div>
        <button @click="generateChat" class="generate-button">
            Create Chat
        </button>
    </div>
</template>

<style scoped>
.link-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background-color: #1a1a1a;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.title {
    color: #e0e0e0;
    margin-bottom: 1.5rem;
    font-size: 1.75rem;
    font-weight: 600;
}

.input-group {
    display: flex;
    position: relative;
    width: 100%;
    max-width: 500px;
    margin-bottom: 1.5rem;
}

.link-input {
    flex: 1;
    background-color: #2a2a2a;
    color: #e0e0e0;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    width: 100%;
    outline: none;
    transition: all 0.2s ease;
}

.link-input::placeholder {
    color: #999;
    opacity: 0.7;
}

.link-input:focus {
    border-color: #666;
    box-shadow: 0 0 0 2px rgba(100, 100, 100, 0.2);
}

.clipboard-icon {
    width: 20px;
    height: 20px;
    color: #e0e0e0;
}

.copy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    background-color: #4a6bff;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.75rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
    position: relative;
}

.copy-button:hover:not(:disabled) {
    background-color: #3a5aee;
}

.copy-button:active:not(:disabled) {
    background-color: #2949dd;
}

.copy-button:disabled {
    background-color: #3a4050;
    cursor: not-allowed;
    opacity: 0.7;
}

.generate-button {
    background-color: #38b000;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.generate-button:hover {
    background-color: #2b9000;
}

.generate-button:active {
    background-color: #1e7000;
}

.tooltip {
    position: absolute;
    bottom: -35px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: #fff;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, visibility 0.2s ease;
    white-space: nowrap;
}

.tooltip::before {
    content: "";
    position: absolute;
    top: -5px;
    left: 50%;
    margin-left: -5px;
    border-width: 0 5px 5px;
    border-style: solid;
    border-color: transparent transparent #333;
}

.tooltip-visible {
    opacity: 1;
    visibility: visible;
}
</style>
