import Head from "next/head";
import React, { useState, useEffect, useRef } from "react";
// Import the functions you need from the SDKs you need
import { initializeApp  } from "firebase/app";
import { doc, onSnapshot, getFirestore, collection, query, where, getDocs } from "firebase/firestore";

import CountDown from "../components/CountDown";
import {callFromString} from "../helpers/callFromString";
import {saveToStorage, getFromStorage} from "../helpers/localStorage";
import styles from "./index.module.css";

function setupFirestore() {
  if (typeof window !== "undefined" ){
    // Your web app's Firebase configuration
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
      const firebaseConfig = {
        apiKey: "AIzaSyBvybCWxyE5kjRICsxXsyykK6Xnx8IVKw8",
        authDomain: "turing-test-37976.firebaseapp.com",
        projectId: "turing-test-37976",
        storageBucket: "turing-test-37976.appspot.com",
        messagingSenderId: "109122874976",
        appId: "1:109122874976:web:1c9edab030111348db1d05",
        measurementId: "G-Q9VVES0Q31"
      };
    
      // Initialize Firebase
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      return db
    }
}

export default function Home() {
  const [playerInput, setPlayerInput] = useState("");
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState([]);
  const [phrases, setPhrases] = useState([]);
  const [events, setEvents] = useState([]);

  const [timerRunning, setTimerRunning] = useState(false);
  const [timer, setTimer] = useState(120);
  const chatScrollRef = useRef(null)

  // get conversation from firestore
  useEffect(() => {
    let db = setupFirestore()
    let userID = getFromStorage("userID");
    if (!userID) {
      userID = crypto.randomUUID();
      saveToStorage("userID", userID);
    } else {
      const querySnapshot = async function() {
        return await getDocs(query(collection(db, "sessions"), where("userID", "==", userID)));
      }
      querySnapshot().then((sessions) => {
        console.log(sessions)
        if (sessions.size > 0) {
          setConversation(sessions.docs[0].data().sanitizedConversation);
        }
      })
    }
  }, []);

  // timer countdown
  useEffect(() => {
    let timerUpdate;
    if (timerRunning && timer > 0) {
      // Update the count every second
      timerUpdate = setInterval(() => setTimer(timer - 1), 1000);
    }
    // Cleanup the interval when the component unmounts or isRunning changes
    return () => clearInterval(timerUpdate);
  }, [timer, timerRunning]);

  // scroll to bottom of chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [conversation]);

  // functions AI can call via actions
  const aiFunctions = {
    setupGame(title, phraseCount, gameLengthInSeconds) {
      setTimer(gameLengthInSeconds);
      setTimerRunning(false);
      setPhrases(Array(Number(phraseCount)).fill(null))
      setEvents(Array(Number(phraseCount)).fill([]))
      setTitle(title)
    },
    startGame() {
      setTimerRunning(true);
    },
    recordEvent(phraseIndex, event) {
      const eventCopy = [...events[phraseIndex]];
      events[phraseIndex] = eventCopy.push(event);
      setEvents(events);
    },
    finishRound(index, phrase) {
      const copy = [...phrases];
      copy[index] = phrase;
      setPhrases(copy);
    },
    finishGame() {
      setTimerRunning(false);
    }
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setConversation([...conversation, { role: "user", content: playerInput }]);
    setPlayerInput("");
    try {
      setLoading(true);
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playerInput: `${playerInput} [[time remaining: ${timer}]]`, userID: getFromStorage("userID") }),
      });

      const data = await response.json();
      if (response.status !== 200) {
        throw data.error || new Error(`Request failed with status ${response.status}`);
      }

      if (data.actions && data.actions.length > 0) {
        data.actions.forEach((action) => {
          callFromString(action, aiFunctions);
        })
      }

      setConversation([...conversation, { role: "user", content: playerInput }, { role: "system", content: data.message }]);
      setLoading(false);
    } catch(error) {
      // Consider implementing your own error handling logic here
      setLoading(false);
      console.error(error);
      alert(error.message);
    }
  }

  return (
    <div>
      <Head>
        <title>Games with AI</title>
        <link rel="icon" href="/dog.png" />
      </Head>

      <main className={styles.main}>
        <h1>This AI is keeping secrets.</h1>
        <h2>It's your job to guess them.</h2>
        { conversation.length < 1 ? (
          <>
            <p>The daily secret codes are the same for everyone. After you've solved them, you can ask the AI to make up more secret phrases in free play mode.</p>
            <p>Say hello and introduce yourself.</p>
          </>
        ) : (
          <>
            {phrases.length > 0 ? (
              <div className={styles.dailyScoreCard}>
                <div style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                }}>
                  <h3 style={{margin: "6px", padding: "6px", borderRadius: "3px", backgroundColor: "white"}}>{title}</h3>
                  <div style={{margin: "6px", padding: "6px", borderRadius: "3px", backgroundColor: "white", display: "flex"}}>
                    <img src="/timer.png" style={{height: "22px", width: "22px", marginRight: "6px"}}/>
                    <CountDown time={timer}/>
                  </div>
                </div>
                <div>
                  {phrases.map((phrase, index) => {
                    return <div key={index}>{`${index + 1}: ${phrase ? phrase : '___________________'}`}</div>
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) }
        <form style={{transition: "bottom 1s", bottom: conversation.length < 1 ? "40vh" : "0px"}}onSubmit={onSubmit}>
          <input
            type="text"
            name="playerInput"
            placeholder="talk to the AI"
            value={playerInput}
            onChange={(e) => setPlayerInput(e.target.value)}
          />
          <input type="submit" value={loading ? "..." : "Send"} disabled={loading || !playerInput || !playerInput.trim()}/>
        </form>
        <div className={styles.scroll} ref={chatScrollRef} style={{overflowY: "scroll", padding: "10px"}}>
          <div style={{
            maxWidth: "800px", width: "calc(100vw - 30px)", display: "flex", flexDirection: "column", justifyContent: "flex-start"
          }}>
            {
              conversation ? conversation.map((message) => {
                return <div key={message.content}  className={message.role === "user" ? styles.user : styles.agent }>{message.content}</div>
              }) : null
            }
          </div>
        </div>
      </main>
    </div>
  );
}
