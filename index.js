const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory output capture
function runLuaU(code) {
  let output = [];
  let hasError = false;
  let errorMsg = '';

  const print = (...args) => output.push(args.join(' '));
  const warn = print;
  error = (msg) => { hasError = true; errorMsg = msg; };

  const game = {
    HttpGet: async (url) => {
      try {
        const res = await fetch(url);
        return await res.text();
      } catch {
        return `--[HttpGet failed]--`;
      }
    },
    Players: { LocalPlayer: { Name: "YeekzyUser" } }
  };

  const getgenv = () => ({ game, print, warn, error });

  try {
    // Luau polyfills + loadstring
    const envCode = `
      _G.print = print; _G.warn = warn; _G.error = error;
      _G.game = game; _G.getgenv = getgenv;
      loadstring = function(src)
        local fn, err = load(src)
        if not fn then error(err) end
        return fn
      end
    `;

    const fullCode = envCode + code;
    const func = new Function('print', 'warn', 'error', 'game', 'getgenv', fullCode);
    func(print, warn, error, game, getgenv);

    return { success: !hasError, result: output.join('\n') || 'Executed (no output)' };
  } catch (e) {
    return { success: false, result: 'Error: ' + (e.message || e) };
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/execute', async (req, res) => {
  const code = req.body.code || '';
  const { success, result } = runLuaU(code);

  res.sendFile(path.join(__dirname, 'public', 'index.html')); // Will show result via JS in HTML
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Yeekzy Executor v5 ready on port ${port}`));
