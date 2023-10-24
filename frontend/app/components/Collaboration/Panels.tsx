import React, { useEffect } from 'react';
import LanguageSelector from './LanguageSelect';
import QuestionDropdown from './QuestionDropdown';
import CollabEditor from './CollabEditor';

type PanelProps = {
    language: string,
    setLanguage: (language: string) => void,
    readEditorValue?: string,
    setReadEditorValue?: (value: string) => void,
    writeEditorValue?: string,
    setWriteEditorValue?: (value: string) => void,
    allowed: boolean,
    sessionId: string | string[],
    isTimeUp: boolean,
    randomQuestion: any
    userId: any
};


export const LeftPanel: React.FC<PanelProps> = ({
    language, setLanguage,
    writeEditorValue, setWriteEditorValue,
    allowed, sessionId, isTimeUp, randomQuestion, userId
}) => {
    useEffect(() => {
        // Load the value from localStorage when the component mounts
        const savedValue = localStorage.getItem('saved');
        if (savedValue !== null && setWriteEditorValue) {
            setWriteEditorValue(savedValue);
        }
    }, []);
    
    useEffect(()=> {
        if (writeEditorValue) {
            localStorage.setItem('saved', writeEditorValue);
        }
    },[writeEditorValue])
    return (
        <div className={`${isTimeUp ? 'items-start' : 'flex-1 mr-2 mt-0 flex flex-col '}`}>
            {!isTimeUp &&
                <LanguageSelector language={language} setLanguage={setLanguage} />
            }
            <CollabEditor
                editorValue={writeEditorValue || " "}
                setEditorValue={setWriteEditorValue}
                disabled={!allowed}
                language={language}
                sessionId={sessionId}
                isTimeUp={isTimeUp}
                userId = {userId}
            />
        </div>
    );
}

export const RightPanel: React.FC<PanelProps> = ({
    language, setLanguage,
    readEditorValue, setReadEditorValue,
    allowed, sessionId, isTimeUp, randomQuestion, userId
}) => {
    return (
        <div className={`${isTimeUp ? 'items-start' : 'flex-1 ml-2'}`}>
            {!isTimeUp &&
                <QuestionDropdown randomQuestion={randomQuestion} />
            }
            <CollabEditor
                editorValue={readEditorValue || " "}
                setEditorValue={setReadEditorValue}
                disabled={true}
                language={language}
                sessionId={sessionId}
                isTimeUp={isTimeUp}
                userId = {userId}
            />
        </div>
    );
}

