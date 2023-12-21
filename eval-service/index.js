const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const cheerio = require('cheerio');

app.use(express.json());

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5001',
  'http://localhost:5002',
  'http://localhost:5003',
  'http://localhost:5004',
  'http://localhost:5005',
  'http://localhost:5006',
  'http://localhost:5007',
  // node ip
  'http://34.123.40.181:30800',
  'http://34.123.40.181:30700',
  'http://34.123.40.181:30600',
  'http://34.123.40.181:30500',
  'http://34.123.40.181:30400',
  'http://34.123.40.181:30300',
  'http://34.123.40.181:30200',
  'http://34.123.40.181:30100',
  'http://34.123.40.181:30000',
  // frontend ip
  'http://34.68.28.7:3000',
];

const corsOptions = {
  credentials: true,
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg =
        'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
};

app.use(cors(corsOptions));

const apiKey = process.env.JUDGE0_API_KEY;
const baseUrl = process.env.JUDGE0_BASE_URL;
const openaiKey =
  process.env.NODE_ENV === 'production'
    ? process.env.OPENAPI_KEY
    : process.env.OPEN_AI_API_KEY;

console.log('open api key: ', openaiKey);

function extractTextFromHTML(html) {
  const $ = cheerio.load(html);
  const textElements = [];

  $('*').each((index, element) => {
    const text = $(element).text().trim();
    if (text) {
      textElements.push(text);
    }
  });

  return textElements.join(' ');
}

app.post('/compile', async (req, res) => {
  try {
    const { sourceCode, languageId } = req.body;

    const response = await axios.post(
      `${baseUrl}/submissions/?base64_encoded=false&wait=false`,
      {
        source_code: sourceCode,
        language_id: languageId, // Replace with the appropriate language ID (e.g., 1 for C++)
      },
      {
        headers: {
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          'X-RapidAPI-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const submissionToken = response.data.token;
    // Poll the status until the compilation is finished
    const compilationResult = await pollCompilationStatus(submissionToken);
    console.log('result:', compilationResult);
    res.json({ result: compilationResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const pollCompilationStatus = async (submissionToken) => {
  try {
    while (true) {
      const response = await axios.get(
        `https://judge0-ce.p.rapidapi.com/submissions/${submissionToken}`,
        {
          headers: {
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
            'X-RapidAPI-Key': apiKey,
          },
        }
      );
      const status = response.data.status.description;
      console.log(status);
      if (status === 'In Queue' || status === 'Processing') {
        // If the submission is still in the queue or processing, continue polling
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before polling again
      } else {
        // Handle other statuses as needed
        const stdout = response.data.stdout;
        const stderr = response.data.stderr;

        if (stdout != null) {
          return stdout;
        } else {
          return stderr;
        }
      }
    }
  } catch (error) {
    throw new Error('Error polling submission status: ' + error.message);
  }
};

app.post('/evaluate', async (req, res) => {
  try {
    console.log('Evaluating');
    const { code, language, description, compilationResult } = req.body;
    const extractedText = extractTextFromHTML(description);
    // Construct the input for ChatGPT
    const chatGptInput = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful computer science professor.',
        },
        {
          role: 'user',
          content: `Imagine you are a helpful computer science professor.
    Here is the question description: ${extractedText}
    Here is the code the student wrote: ${code} in ${language}
    Here is the compilation result: ${compilationResult}
    Repeat the question description and score the student's code out of 10 total marks`,
        },
      ],
    };
    console.log(chatGptInput);
    // Make a request to the OpenAI GPT-3 API for code evaluation
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      chatGptInput,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
      }
    );
    console.log('retrieved response from openai');

    // Extract and return the response from ChatGPT
    const chatGptMessageContent = response.data.choices[0].message.content;

    res.json({ result: chatGptMessageContent });
  } catch (error) {
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
    }
    res.status(500).json({ error: error.message });
  }
});

app.listen(5005, () => {
  console.log(`eval-service listening at http://localhost:5005`);
});
