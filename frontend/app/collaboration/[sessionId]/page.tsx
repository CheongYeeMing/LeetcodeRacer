'use client'
import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Timer from '@/app/components/Collaboration/Timer';
import { LeftPanel, RightPanel } from '@/app/components/Collaboration/Panels';
import CompileEvaluation from '@/app/components/Collaboration/CompileEvaluation';
import ChatComponent from '@/app/components/ChatService/ChatComponent';

const CollaborationSession = () => {
  const { sessionId } = useParams();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [userId, setUserId] = useState('');

  const [writeEditorValue, setWriteEditorValue] = useState<string>('');
  const [readEditorValue, setReadEditorValue] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(10000);

  const [compileResult, setCompileResult] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState('');
  let randomQuestion = useRef<Question | null>(null);
  let description = randomQuestion.current?.description;

  const [isEndSessionPopupOpen, setIsEndSessionPopupOpen] = useState(false);
  const [isDisconnectPopupOpen, setIsDisconnectPopupOpen] = useState(false);
  const [isEndingSessionPopupOpen, setIsEndingSessionPopupOpen] = useState(false);
  const [progress, setProgress] = useState(100);
  const [redirectTime, setRedirectTime] = useState(5000);

  const [isWaitingForOpponentPopupOpen, setIsWaitingForOpponentPopupOpen] = useState(false);
  const [opponentScore, setOpponentScore] = useState(0);


  interface Question {
    id: number,
    title: string,
    difficulty: string,
    categories: string[],
    description: string,
    question_link: string,
    solution_link: string,
  };


  const languageIds: Record<string, number> = {
    javascript: 63,
    python: 71,
    java: 81,
    csharp: 17,
  };

  const [isTimeUp, setisTimeUp] = useState<boolean>(false);

  useEffect(() => {
    const websocket = new WebSocket(`ws://localhost:8004/${sessionId}`);

    const waitForQuestion = () => {
      return new Promise((resolve) => {
        const handler = (message: any) => {
          const data = JSON.parse(message.data);
          if (data.hasOwnProperty('question')) {
            const question = data.question as Question;
            resolve(question);
            websocket.removeEventListener('message', handler);
          }
        };
        websocket.addEventListener('message', handler);
      });
    };

    websocket.onopen = () => {
      const storedUserId = localStorage.getItem('userid');

      if (storedUserId) {
        setUserId(storedUserId);
      }

      websocket.send(JSON.stringify({ userId: storedUserId }));
    };

    websocket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      console.log('Received message:', data);

      if (data.hasOwnProperty('allowed')) {
        setAllowed(data.allowed);
      }

      if (data.hasOwnProperty('timeLeft')) {
        setTimeLeft(data.timeLeft);
      }

      waitForQuestion().then((question) => {
        randomQuestion.current = question as Question;
      });

      if (data.type === 'requestEndSession') {
        if (data.reason === 'disconnect') {
          // Handle end session due to disconnect
          setIsDisconnectPopupOpen(true);
        } else {
          setIsEndSessionPopupOpen(true);
        }
      }
      if (data.type === 'END_SESSION') {
        handleEndSession();
      }

      if (data.type === 'cancelled') {
        setIsEndSessionPopupOpen(false);
      }

      if (data.hasOwnProperty('score')) {
        setOpponentScore(data.score);
      }

    };

    websocket.onclose = (event) => {
      console.log('WebSocket is closed', event);
      if (event.wasClean) {
        console.log('Connection closed cleanly');
      } else {
        console.log('Connection died');
      }
    };

    websocket.onerror = (event) => {
      console.log('WebSocket error:', event);
    };

    setWs(websocket);

  }, []);

  const router = useRouter();

  const handleEndSession = () => {
    localStorage.removeItem('timerExpired');
    localStorage.removeItem('saved');
    setIsEndingSessionPopupOpen(true);
  };

  useEffect(() => {
    if (isEndingSessionPopupOpen) {
      const interval = setInterval(() => {
        setProgress((prev) => Math.max(prev - (100 / 5), 0));
        setRedirectTime((prev) => Math.max(prev - 1000, 0));
      }, 1000);

      const timeout = setTimeout(() => {
        router.push('/dashboard');
        setIsEndingSessionPopupOpen(false);
      }, redirectTime);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isEndingSessionPopupOpen, router]);

  const handleRequestEndSession = () => {
    setIsWaitingForOpponentPopupOpen(true);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type: 'REQUEST_END_SESSION',
        userId: userId
      });
      ws.send(message);
    } else {
      console.log('WebSocket is not open');
    }
    setIsEndSessionPopupOpen(false);
  };

  const sendCancelRequest = (ws: WebSocket | null) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type: 'cancelEndRequest',
        userId,
      });
      ws.send(message);
    }
  }



  const handleAgreeToEndSession = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type: 'REQUEST_END_SESSION',
        userId,
        confirmEnd: true
      });
      ws.send(message);
    } else {
      console.log('WebSocket is not open');
    }

    setIsEndSessionPopupOpen(false);
  };

  const handleDisagreeToEndSession = () => {
    setIsEndSessionPopupOpen(false);
  };

  const handleTimeUp = async (timeIsUp: boolean) => {
    if (timeIsUp) {
      setisTimeUp(true);
    }
  };

  const [language, setLanguage] = useState('javascript');

  const handleCompile = async () => {
    setIsLoading(true);
    try {
      const selectedLanguageId = languageIds[language];
      const editorValue = writeEditorValue;
      console.log("Editor value:", editorValue);
      const response = await axios.post('http://localhost:7000/compile', {
        sourceCode: editorValue,
        languageId: selectedLanguageId, // Replace with the appropriate language ID
      });
      console.log('Response:', response.data.result); // Log the response
      // Extract the compilation result from the response and set it in the state
      const compilationResult = response.data.result;
      console.log('Compilation Result:', compilationResult);
      setCompileResult(compilationResult);
      localStorage.setItem('compilationResult', compilationResult);
    } catch (error: any) {
      console.error('Error executing code:', error.message);
    } finally {
      setIsLoading(false);
    }
  };


  const handleEvaluate = async () => {
    setIsLoading(true);

    try {
      const editorValue = writeEditorValue;
      const questionData = randomQuestion.current;

      if (questionData) {
        const response = await axios.post(
          'http://localhost:7000/evaluate', // Replace with your eval-service host
          {
            code: editorValue,
            language: language,
            description: questionData.description,
            compilationResult: compileResult,
          }
        );

        const evaluationResult = response.data.result;
        setEvaluationResult(evaluationResult);
        localStorage.setItem(`evaluationResult_${userId}`, evaluationResult);
        console.log('Evaluation Result:', evaluationResult);
      } else {
        console.error('randomQuestion is null or undefined');
      }
    } catch (error: any) {
      console.error('Error evaluating code:', error.message);
    } finally {
      setIsLoading(false);
      setIsModalOpen(true);
    }
  };

  const handleEvaluateAndCompile = async () => {
    await handleCompile(); // First, compile the code
    await handleEvaluate(); // Then, evaluate the code

    const score = parseScoreFromEvaluationResult(localStorage.getItem(`evaluationResult_${userId}`));
    const message = JSON.stringify({
      score: score,
      userId: userId
    });
    sendWebSocketScore(message);

    const outcome = score > opponentScore ? 1
      : (score === opponentScore)
        ? 0
        : 2

    const historyData = {
      userId: userId,
      questionId: randomQuestion.current?.id || 0,
      sessionId: sessionId,
      score: score, // Update with the actual score
      raceOutcome: outcome, // Update with the actual outcome
      feedback: localStorage.getItem(`evaluationResult_${userId}`), // Update with actual feedback
      submission: writeEditorValue,
      attemptedDate: new Date().toISOString(),
    };
    console.log("history data :", historyData);
    sendHistoryData(historyData);
  };

  const sendWebSocketScore = (message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    } else {
      console.log('WebSocket is not open');
    }
  };





  const parseScoreFromEvaluationResult = (evaluationResult) => {
    // Check if the evaluationResult contains "Student's Score" and a number
    const scoreRegex = /Student's Score\s*:\s*([\d.]+)\/10/i;
    const match = evaluationResult.match(scoreRegex);

    if (match && match[1]) {
      // Parse the matched score as a float and return it
      const score = parseFloat(match[1]);
      if (!isNaN(score)) {
        return score;
      }
    }

    // Return 0 if no valid score is found in the evaluationResult
    return 0;
  };


  async function sendHistoryData(data): Promise<History> {
    try {
      const response = await fetch('http://localhost:8006/history', {
        method: 'POST',
        headers: {
          'token': localStorage.token,
          'Content-Type': 'application/json', // Add this line to specify the content type
        },
        cache: 'no-store',
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // Handle a successful response here if needed
        // You can access the response data using response.json()
        const historyData: History = await response.json();
        console.log('History Data Sent:', historyData);
        return historyData;
      } else {
        // Handle error here if the response is not OK (e.g., response.status !== 200)
        console.error('Error sending history data:', response.statusText);
        throw new Error('Error sending history data');
      }
    } catch (error) {
      // Handle any network or other errors here
      console.error('Error sending history data:', error);
      throw error;
    }
  }



  useEffect(() => {
    if (isTimeUp) {
      handleEvaluateAndCompile();
    }
  }, [isTimeUp]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
  }

  const leftPanelProps = {
    language,
    setLanguage,
    writeEditorValue,
    setWriteEditorValue,
    allowed,
    sessionId,
    isTimeUp,
    description,
    userId
  };

  const rightPanelProps = {
    language,
    setLanguage,
    readEditorValue,
    setReadEditorValue,
    allowed,
    sessionId,
    isTimeUp,
    description,
    userId
  };

  const CompileEvaluationProps = {
    handleCompile,
    handleEvaluateAndCompile,
    isLoading,
    isModalOpen,
    handleCloseModal,
    compileResult,
    evaluationResult
  };

  return isTimeUp
    ? (
      <div className='min-h-screen flex flex-row'>
        <div className='flex-1'>
          <div className='flex flex-col'>
            <LeftPanel {...leftPanelProps} />
            <RightPanel {...rightPanelProps} />
          </div>
        </div>
        <button onClick={handleRequestEndSession} className="bg-red-500 text-white p-2 rounded fixed bottom-4 right-4">
          End
        </button>
        {isWaitingForOpponentPopupOpen && (
          <div className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white border border-gray-300 rounded-lg p-4 w-64 shadow-lg">
              <p className="text-center text-black mb-4">Waiting for opponent to accept ending the session...</p>
              <div className="flex justify-center">
                <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => {
                  sendCancelRequest(ws);
                  setIsWaitingForOpponentPopupOpen(false);
                }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {isEndSessionPopupOpen && (
          <div className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white border border-gray-300 rounded-lg p-4 w-64 shadow-lg">
              <p className="text-center text-black mb-4">Other user wants to end the session. Do you agree?</p>
              <div className="flex justify-between">
                <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={handleAgreeToEndSession}>Yes</button>
                <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={handleDisagreeToEndSession}>No</button>
              </div>
            </div>
          </div>
        )}
        {isEndingSessionPopupOpen && (
          <div className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white border border-gray-300 rounded-lg p-4 w-64 shadow-lg flex flex-col items-center">
              <p className="text-center text-black mb-4">Redirecting you to mainpage..</p>
              <div
                className="radial-progress m-4 text-red-500 relative"
                style={{ '--value': progress } as any}
              >
                <p
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-500"
                >
                  {Math.round(redirectTime / 1000)}
                </p>
              </div>
            </div>
          </div>
        )}
        {isDisconnectPopupOpen && (
          <div className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white border border-gray-300 rounded-lg p-4 w-64 shadow-lg">
              <p className="text-center text-black mb-4">The user has disconnected.</p>
              <div className="flex justify-between">
                <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={() => {
                  setIsEndingSessionPopupOpen(true);
                  setIsDisconnectPopupOpen(false);
                }}>End</button>
                <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => setIsDisconnectPopupOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
        <div className='flex-1'>
          <div className='flex flex-col'>
            <div className='bg-gray-700 text-center p-1'>
              <span className='bg-yellow-200 rounded-lg p-1 text-black m-2'>
                &nbsp;Here&apos;s how you performed!&nbsp;
              </span>
            </div>
            <div className='flex-2 border-dashed border-2 w-full p-10 overflow-y-auto'>
              {localStorage.getItem(`evaluationResult_${userId}`)}
            </div>
            <div className="flex-3">
              <div className='bg-gray-700 text-center p-1'>
                <span className='bg-yellow-200 rounded-lg p-1 text-black m-2'>
                  &nbsp;Chat with your opponent!&nbsp;
                </span>
              </div>
              <ChatComponent sessionId={sessionId} />
            </div>
          </div>
        </div>
      </div >
    ) : (
      <div className='min-h-screen flex flex-col'>
        <div className='flex justify-between'>
          <LeftPanel {...leftPanelProps} />
          {allowed &&
            <Timer duration={timeLeft} onTimeUp={handleTimeUp} />
          }
          <RightPanel {...rightPanelProps} />
        </div>
        <CompileEvaluation {...CompileEvaluationProps} />
        {isDisconnectPopupOpen && (
          <div className="fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white border border-gray-300 rounded-lg p-4 w-64 shadow-lg">
              <p className="text-center text-black mb-4">The user has disconnected.</p>
              <div className="flex justify-between">
                <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={handleEndSession}>End</button>
                <button className="bg-red-500 text-white px-4 py-2 rounded" onClick={() => setIsDisconnectPopupOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

};

export default CollaborationSession;