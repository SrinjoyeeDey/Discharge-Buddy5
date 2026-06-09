import React, { useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity,
    FlatList, StyleSheet, SafeAreaView
} from "react-native";

export default function TelemedicineChat() {
    const [messages, setMessages] = useState([
        { id: "1", text: "Hello! I'm your AI health assistant. Please describe your symptoms.", sender: "ai" }
    ]);
    const [inputText, setInputText] = useState("");

    const sendMessage = () => {
        if (!inputText.trim()) return;
        const userMessage = { id: Date.now().toString(), text: inputText, sender: "patient" };
        setMessages(prev => [...prev, userMessage]);
        setInputText("");

        // AI auto response
        setTimeout(() => {
            const aiReply = { id: (Date.now() + 1).toString(), text: "Thank you. A doctor will review your symptoms shortly.", sender: "ai" };
            setMessages(prev => [...prev, aiReply]);
        }, 1000);
    };

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.header}>Telemedicine Chat</Text>
            <FlatList
                data={messages}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <View style={[styles.bubble, item.sender === "patient" ? styles.patientBubble : styles.aiBubble]}>
                        <Text style={styles.bubbleText}>{item.text}</Text>
                    </View>
                )}
            />
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Describe your symptoms..."
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                    <Text style={styles.sendText}>Send</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f5f5f5" },
    header: { fontSize: 20, fontWeight: "bold", padding: 16, textAlign: "center" },
    bubble: { margin: 8, padding: 12, borderRadius: 12, maxWidth: "80%" },
    patientBubble: { backgroundColor: "#007AFF", alignSelf: "flex-end" },
    aiBubble: { backgroundColor: "#ffffff", alignSelf: "flex-start" },
    bubbleText: { color: "#000", fontSize: 14 },
    inputRow: { flexDirection: "row", padding: 12, backgroundColor: "#fff" },
    input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
    sendBtn: { backgroundColor: "#007AFF", padding: 12, borderRadius: 8, marginLeft: 8 },
    sendText: { color: "#fff", fontWeight: "bold" },
});