<script setup lang="ts">
let msg = "rng";
let ws: WebSocket | null = null;
const store = reactive({
    messages: [],
});

const connect = async () => {
    const isSecure = location.protocol === "https:";
    const url = (isSecure ? "wss://" : "ws://") + location.host + "/_ws";
    if (ws) {
        log("ws", "Closing previous connection before reconnecting...");
        ws.close();
        clear();
    }

    log("ws", "Connecting to", url, "...");
    ws = new WebSocket(url);

    ws.addEventListener("message", async (event) => {
        let data =
            typeof event.data === "string" ? data : await event.data.text();
        const { user = "system", message = "" } = data.startsWith("{")
            ? JSON.parse(data)
            : { message: data };
        log(
            user,
            typeof message === "string" ? message : JSON.stringify(message)
        );
    });

    await new Promise((resolve) => ws.addEventListener("open", resolve));
    log("ws", "Connected!");
};

const log = (user, ...args) => {
    console.log("[ws]", user, ...args);
    store.messages.push({
        text: args.join(" "),
        formattedText: "",
        user: user,
        date: new Date().toLocaleString(),
    });
    scroll();
    format();
};

const SendMessage = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        log("system", "WebSocket not connected!");
        return;
    }

    // Send structured message matching server expectations
    ws.send(JSON.stringify({ user: "user", message: msg }));
    log("me", msg); // Log your own message locally
    msg = ""; // Clear the input after sending
};
const clear = () => {
    store.messages = [];
};
onMounted(() => {
    connect();
});
</script>

<template>
    <div>
        <h1>Home</h1>

        <input v-model="msg" />
        <button @click="SendMessage">Send</button>
    </div>
</template>

<style scoped></style>
