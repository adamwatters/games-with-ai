import { Configuration, OpenAIApi } from "openai";
import {GAME} from "../../prompts"
import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore"
import crypto from 'node:crypto'

export default async function (req, res) {

  const serviceAccount = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  );
  
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  
  const db = getFirestore();
  
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message: "OpenAI API key not configured, please follow instructions in README.md",
      }
    });
    return;
  }

  const userID = req.body.userID;
  if (!userID) {
    res.status(400).json({
      error: {
        message: "UserID required with request. This is a dev error, please let us know if you see this!",
      }
    });
    return;
  }

  const sessionsRef = db.collection('sessions');
  const snapshot = await sessionsRef.where('userID', '==', userID).get();
  
  let conversation = [];

  let sessionDocRef;
  if (snapshot.empty) {
    const data = {
      userID: userID,
      conversation: [],
      sanitizedConversation: [],
    }
    sessionDocRef = db.collection('sessions').doc(crypto.randomUUID());
    await sessionDocRef.set(data);
  } else {
    sessionDocRef = snapshot.docs[0].ref
    conversation = snapshot.docs[0].data().conversation
  }

  const playerInput = req.body.playerInput || '';
  if (playerInput.trim().length === 0) {
    res.status(400).json({
      error: {
        message: "Please enter a valid message",
      }
    });
    return;
  }

  try {
    let newUserInput = {role: "user", content: playerInput}
    conversation.push(newUserInput)
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      frequency_penalty: 1,
      max_tokens: 256,
      presence_penalty: 1,
      stream: false,
      temperature: 0.8,
      top_p: .7,
      messages: [
        {role: "system", content: GAME},
        ...conversation
      ],
    });
    let newAnswer = completion.data.choices[0].message
    const patternToMatchApiCalls = /\[\[.*?\]\]/g;
    const calls = newAnswer.content.match(patternToMatchApiCalls)
    const sanitizedAnswer = newAnswer.content.replace(patternToMatchApiCalls, '');
    res.status(200).json({ message: sanitizedAnswer, actions: calls });
    // update the conversation in firebase
    sessionDocRef.update({
      conversation: FieldValue.arrayUnion(newUserInput, newAnswer),
      sanitizedConversation: FieldValue.arrayUnion(newUserInput, {role: "system", content: sanitizedAnswer})
    })
  } catch(error) {
    // Consider adjusting the error handling logic for your use case
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: 'An error occurred during your request.',
        }
      });
    }
  }
}
