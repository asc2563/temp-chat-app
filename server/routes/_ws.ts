// v4 - Fixed duplicate message issue
interface wsMessage {
    user: string;
    message: string;
    kill?: boolean;
    killRoom?: boolean;
    chatroom: string;
    clientId?: string; // Add clientId for sender identification
    close?: boolean; // Close the clients page after sending the message
}

// Store connections with their chatrooms
const connections = new Map<WebSocket, string>();
// Store client identifiers
const clientIds = new Map<WebSocket, string>();
// Store chatrooms with their connections
const chatRooms = new Map<string, Set<WebSocket>>();

// Debug helper - detailed for diagnostics
function logState() {
    console.log('---------- WebSocket Server State ----------');
    console.log(`[ws] Active connections: ${connections.size}`);
    console.log(`[ws] Active chatrooms: ${chatRooms.size}`);
    for (const [room, clients] of chatRooms.entries()) {
        console.log(`[ws] Room ${room}: ${clients.size} clients`);
        let i = 0;
        for (const client of clients) {
            // readyState might not be directly accessible in Nitro WebSockets
            console.log(`  - Client #${++i}: clientId=${clientIds.get(client) || 'unknown'}`);
        }
    }
    console.log('------------------------------------------');
}

export default defineWebSocketHandler({
    open(ws) {
        console.log("[ws] New connection");
        // Generate and store a unique client ID
        const clientId = generateClientId();
        clientIds.set(ws, clientId);

        // Send welcome message (don't need a room yet)
        ws.send(JSON.stringify({
            user: "server",
            message: "Connected! Waiting for room information...",
            chatroom: "",
            clientId: clientId // Send clientId to the client
        }));
    },

    message(ws, message) {
        try {
            const data = JSON.parse(message.toString());
            let { user, message: msgContent, chatroom, kill, killRoom, clientId } = data;

            // Always ensure chatroom is a string
            chatroom = String(chatroom || "");

            // Get this client's ID
            const thisClientId = clientIds.get(ws) || "unknown";

            console.log(`[ws] Received message from ${user} (clientId: ${thisClientId}) in room "${chatroom}": ${msgContent}`);

            // Handle kill request (disconnect individual client)
            if (kill === true) {
                console.log("[ws] Client requested connection termination");
                ws.close(1000, "Client requested termination");
                return;
            }

            // Handle killRoom request (clear all messages in a room)
            if (killRoom === true) {
                console.log(`[ws] Kill room request for room ${chatroom}`);

                if (!chatroom) {
                    ws.send(JSON.stringify({
                        user: "server",
                        message: "Error: No chatroom specified for kill room operation",
                        chatroom: "",
                        clientId: thisClientId
                    }));
                    return;
                }

                // Notify everyone in the room about the kill command
                if (chatRooms.has(chatroom)) {
                    broadcastToRoom(chatroom, null, {
                        user: "server",
                        message: "⚠️ THIS ROOM HAS BEEN KILLED - ALL MESSAGES CLEARED ⚠️",
                        chatroom: chatroom,
                        clearAllMessages: true,
                        clientId: thisClientId,
                    });

                    console.log(`[ws] Room ${chatroom} has been killed`);
                } else {
                    console.log(`[ws] Cannot kill non-existent room: ${chatroom}`);
                }
                return;
            }

            // We require a chatroom for all messages
            if (!chatroom) {
                ws.send(JSON.stringify({
                    user: "server",
                    message: "Error: No chatroom specified",
                    chatroom: "",
                    clientId: thisClientId
                }));
                return;
            }

            // Check if this connection is already in a room
            const currentRoom = connections.get(ws);

            // Handle room change or new room assignment
            if (!currentRoom || currentRoom !== chatroom) {
                // Remove from previous room if any
                if (currentRoom && chatRooms.has(currentRoom)) {
                    chatRooms.get(currentRoom).delete(ws);

                    // Notify others that user left the previous room
                    broadcastToRoom(currentRoom, ws, {
                        user: "server",
                        message: "A user left the chat",
                        chatroom: currentRoom,
                        clientId: thisClientId
                    });

                    // Clean up empty room
                    if (chatRooms.get(currentRoom).size === 0) {
                        chatRooms.delete(currentRoom);
                        console.log(`[ws] Room ${currentRoom} is now empty and removed`);
                    }
                }

                // Create room if it doesn't exist
                if (!chatRooms.has(chatroom)) {
                    chatRooms.set(chatroom, new Set());
                }

                // Add to new room
                chatRooms.get(chatroom).add(ws);
                connections.set(ws, chatroom);

                // Welcome to the room
                ws.send(JSON.stringify({
                    user: "server",
                    message: `You've joined room ${chatroom}`,
                    chatroom: chatroom,
                    clientId: thisClientId
                }));

                // Notify others about the new user
                broadcastToRoom(chatroom, ws, {
                    user: "server",
                    message: "A new user joined the chat",
                    chatroom: chatroom,
                    clientId: thisClientId
                });

                console.log(`[ws] Client joined room ${chatroom}`);
                logState();
            } else {
                // This is a regular message to the current room
                console.log(`[ws] Broadcasting regular message to room ${chatroom}`);

                // Include the sender's clientId in the message
                const messageToSend = {
                    user: user,
                    message: msgContent,
                    chatroom: chatroom,
                    clientId: thisClientId // Important: Include sender's ID
                };

                // Broadcast to everyone in the room (including sender)
                broadcastToAll(chatroom, messageToSend);
            }
        } catch (error) {
            console.error("[ws] Error processing message:", error);
            ws.send(JSON.stringify({
                user: "server",
                message: "Error processing message: " + String(error),
                chatroom: "",
                clientId: clientIds.get(ws) || "unknown"
            }));
        }
    },

    close(ws) {
        const room = connections.get(ws);
        const clientId = clientIds.get(ws) || "unknown";

        if (room && chatRooms.has(room)) {
            // Remove from room
            chatRooms.get(room).delete(ws);

            // Notify others in room
            broadcastToRoom(room, ws, {
                user: "server",
                message: "A user left the chat",
                chatroom: room,
                clientId: clientId
            });

            // Clean up empty room
            if (chatRooms.get(room).size === 0) {
                chatRooms.delete(room);
                console.log(`[ws] Room ${room} is now empty and removed`);
            }
        }

        // Remove from connections and clientIds
        connections.delete(ws);
        clientIds.delete(ws);

        console.log(`[ws] Connection closed for client ${clientId}`);
        logState();
    },

    error(ws, error) {
        console.error(`[ws] WebSocket error for client ${clientIds.get(ws) || "unknown"}:`, error);
    }
});

// Generate a random client ID
function generateClientId() {
    return Math.random().toString(36).substring(2, 15);
}

// Broadcast to everyone in a room except the sender
function broadcastToRoom(room: string, exclude: WebSocket | null, message: any) {
    if (!chatRooms.has(room)) {
        console.log(`[ws] Cannot broadcast to non-existent room: ${room}`);
        return;
    }

    const clients = chatRooms.get(room);

    if (!clients || clients.size === 0) {
        console.log(`[ws] No clients in room ${room} to broadcast to`);
        return;
    }

    console.log(`[ws] Broadcasting to ${clients.size} clients in room ${room}`);

    // Ensure the message has chatroom information
    const messageToSend = { ...message };
    if (!messageToSend.chatroom) {
        messageToSend.chatroom = room;
    }

    const messageStr = JSON.stringify(messageToSend);
    let sentCount = 0;

    for (const client of clients) {
        try {
            // Skip the excluded client if specified
            if (exclude && client === exclude) {
                console.log(`[ws] Skipping excluded client in broadcast`);
                continue;
            }

            // In h3/nitro WebSockets, send() should work without explicit readyState checks
            client.send(messageStr);
            sentCount++;
        } catch (err) {
            console.error(`[ws] Error sending message:`, err);

            // Try to clean up problematic client
            try {
                cleanupClient(client);
            } catch (cleanupErr) {
                console.error("[ws] Error cleaning up client:", cleanupErr);
            }
        }
    }

    console.log(`[ws] Broadcast complete - sent to ${sentCount}/${clients.size} clients`);
}

// Broadcast to ALL clients in a room, including the sender
function broadcastToAll(room: string, message: any) {
    broadcastToRoom(room, null, message);
}

// Clean up a problematic client
function cleanupClient(client: WebSocket) {
    const room = connections.get(client);
    const clientId = clientIds.get(client) || "unknown";

    if (room && chatRooms.has(room)) {
        chatRooms.get(room).delete(client);

        // Clean up empty room
        if (chatRooms.get(room).size === 0) {
            chatRooms.delete(room);
            console.log(`[ws] Room ${room} is now empty and removed`);
        }
    }

    connections.delete(client);
    clientIds.delete(client);
    console.log(`[ws] Cleaned up problematic client ${clientId}`);
}