<template>
    <div class="container mx-auto p-4">
        <div class="mb-4">
            <h1 class="text-2xl font-bold">Chat Room: {{ chatId }}</h1>
            <div class="text-sm">
                Status:
                <span
                    :class="{
                        'text-green-600 font-bold': isConnected,
                        'text-red-600 font-bold': !isConnected,
                    }"
                >
                    {{ connectionStatus }}
                </span>
                <button
                    @click="connect"
                    class="ml-2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                >
                    Reconnect
                </button>
            </div>
        </div>

        <div
            class="bg-gray-100 p-4 rounded mb-4 h-96 overflow-y-auto"
            ref="messageContainer"
        >
            <div
                v-for="(msg, index) in store.messages"
                :key="index"
                class="mb-2 p-2 rounded"
                :class="messageClass(msg)"
            >
                <div class="flex justify-between items-baseline">
                    <span class="font-bold">{{ msg.user }}</span>
                    <span class="text-xs text-gray-500">{{ msg.date }}</span>
                </div>
                <p>{{ msg.text }}</p>
            </div>
        </div>

        <div class="flex mb-4">
            <input
                v-model="msg"
                type="text"
                @keyup.enter="sendMessage"
                placeholder="Type a message..."
                class="flex-grow p-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
                @click="sendMessage"
                class="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600"
            >
                Send
            </button>
        </div>

        <div class="flex gap-2">
            <button
                @click="clear"
                class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
                Clear Messages
            </button>
            <button
                @click="killSocket"
                class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
                KILL
            </button>
            <button
                @click="killRoom"
                class="bg-red-900 text-white px-4 py-2 rounded hover:bg-red-800 font-bold"
            >
                KILL ROOM
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
const route = useRoute();
const chatId = route.params.id;
const messageContainer = ref(null);

const msg = ref("");
let ws: WebSocket | null = null;
const isConnected = ref(false);
const myClientId = ref(""); // Store my client ID
const connectionStatus = computed(() => {
    if (!ws) return "Disconnected";

    const states = ["Connecting", "Connected", "Closing", "Closed"];
    return states[ws.readyState];
});

const store = reactive({
    messages: [],
    processedMessageIds: new Set(), // Track processed messages to avoid duplicates
});

const messageClass = (msg) => {
    if (msg.user === "me") return "bg-blue-100 text-right";
    if (msg.user === "server") return "bg-green-100";
    if (msg.user === "system") return "bg-gray-200";
    return "bg-white border";
};

const connect = async () => {
    const isSecure = window.location.protocol === "https:";
    const url = `${isSecure ? "wss" : "ws"}://${window.location.host}/_ws`;

    if (ws) {
        log("system", "Closing previous connection before reconnecting...");
        ws.close();
        // Don't clear messages on reconnect
    }

    log("system", `Connecting to ${url} for chat room ${chatId}...`);

    try {
        ws = new WebSocket(url);

        ws.onmessage = async (event) => {
            try {
                const rawData = event.data;
                let parsedData;

                if (typeof rawData === "string") {
                    parsedData = JSON.parse(rawData);
                } else {
                    parsedData = JSON.parse(await rawData.text());
                }

                console.log("[ws] Received message:", parsedData);

                const {
                    user = "system",
                    message = "",
                    chatroom = "",
                    clearAllMessages = false,
                    clientId = "",
                } = parsedData;

                // If this is the first message, store my client ID
                if (user === "server" && !myClientId.value && clientId) {
                    myClientId.value = clientId;
                    console.log(`[ws] My client ID: ${myClientId.value}`);
                }

                // Handle clear all messages command
                if (
                    clearAllMessages === true &&
                    (chatroom === chatId || chatroom === "")
                ) {
                    console.log(
                        "[ws] Clearing all messages due to kill room command"
                    );
                    clear(); // Clear local messages
                    log("system", message); // Display the kill message
                    window.location.href = "about:blank"; // Reload the page
                    return;
                }

                // Generate a message ID to prevent duplicates
                const messageId = `${clientId}:${message}:${Date.now()}`;

                // Skip if we've already processed this message
                if (store.processedMessageIds.has(messageId)) {
                    console.log(
                        `[ws] Skipping already processed message: ${messageId}`
                    );
                    return;
                }

                // Only process messages for this chat room or server messages with no chatroom
                if (chatroom === chatId || chatroom === "") {
                    // Use "me" for my messages, "other" for other users, or the original user value
                    let displayUser = user;

                    // If this is a user message (not system/server), check the clientId
                    if (user === "user") {
                        // If the message is from me, show as "me" (and skip it since we've already logged it locally)
                        if (clientId === myClientId.value) {
                            console.log(
                                "[ws] Received echo of my own message, skipping"
                            );
                            return;
                        } else {
                            // Message is from another user
                            displayUser = "other";
                        }
                    }

                    // Add message ID to processed set
                    store.processedMessageIds.add(messageId);

                    // Log the message
                    log(
                        displayUser,
                        typeof message === "string"
                            ? message
                            : JSON.stringify(message)
                    );
                } else {
                    console.log(
                        `[ws] Ignored message for different room: ${chatroom} (we're in ${chatId})`
                    );
                }
            } catch (error) {
                console.error("Error parsing message:", error);
                log("system", "Error parsing message: " + String(error));
            }
        };

        ws.onopen = () => {
            isConnected.value = true;
            log("system", "Connected!");

            // Send a join message to notify the server which chatroom we're in
            ws.send(
                JSON.stringify({
                    user: "system",
                    message: "User joined chat",
                    chatroom: chatId,
                })
            );
        };

        ws.onclose = (event) => {
            isConnected.value = false;
            log(
                "system",
                "Disconnected: " + (event.reason || "Unknown reason")
            );
        };

        ws.onerror = (error) => {
            isConnected.value = false;
            console.error("WebSocket error:", error);
            log("system", "Connection error occurred");
        };
    } catch (error) {
        console.error("Failed to initialize WebSocket:", error);
        log(
            "system",
            "Failed to create WebSocket connection: " + String(error)
        );
    }
};

const log = (user, ...args) => {
    console.log("[ws]", user, ...args);
    store.messages.push({
        text: args.join(" "),
        user: user,
        date: new Date().toLocaleString(),
    });

    // Scroll to bottom after messages update
    nextTick(() => {
        if (messageContainer.value) {
            messageContainer.value.scrollTop =
                messageContainer.value.scrollHeight;
        }
    });
};

const sendMessage = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        log("system", "WebSocket not connected!");
        return;
    }

    if (!msg.value.trim()) {
        return; // Don't send empty messages
    }

    const messageText = msg.value.trim();

    // Send structured message with client ID
    ws.send(
        JSON.stringify({
            user: "user",
            message: messageText,
            chatroom: chatId,
            clientId: myClientId.value, // Include my client ID
        })
    );

    // Immediately log my message locally as "me" before server echo
    log("me", messageText);
    msg.value = ""; // Clear input
};

const clear = () => {
    store.messages = [];
    store.processedMessageIds.clear(); // Clear the processed messages set
};

const killSocket = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        log("system", "WebSocket not connected!");
        return;
    }

    // Send kill message
    ws.send(
        JSON.stringify({
            user: "system",
            message: "Disconnecting",
            kill: true,
            chatroom: chatId,
            clientId: myClientId.value,
        })
    );
};

const killRoom = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        log("system", "WebSocket not connected!");
        return;
    }

    if (
        !confirm(
            "Are you sure you want to clear all messages for EVERYONE in this room?"
        )
    ) {
        return;
    }

    // Send kill room message
    ws.send(
        JSON.stringify({
            user: "system",
            message: "Room killed by user",
            killRoom: true,
            chatroom: chatId,
            clientId: myClientId.value,
        })
    );

    // Also clear local messages
    clear();

    log(
        "system",
        "You killed this room. All messages have been cleared for everyone."
    );
};

// Connect when component mounts
onMounted(() => {
    connect();
});

// Clean up when component unmounts
onBeforeUnmount(() => {
    if (ws) {
        ws.close();
    }
});
</script>

<style scoped>
.chat-container {
    max-width: 800px;
    margin: 0 auto;
}

.messages {
    height: 60vh;
    overflow-y: auto;
}

.user-message {
    text-align: right;
    background-color: #e3f2fd;
}

.server-message {
    background-color: #f1f8e9;
}

.system-message {
    background-color: #f5f5f5;
    font-style: italic;
}

.message {
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 4px;
}
</style>
