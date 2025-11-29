const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const fengari = require('fengari');
const {lua, lauxlib, lualib} = fengari;

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static HTML
app.use(express.static(path.join(__dirname, 'public')));

// Handle Lua execution
app.post('/execute', (req, res) => {
    const code = req.body.code || '';
    let result = '';

    try {
        const L = lauxlib.luaL_newstate();
        lualib.luaL_openlibs(L);

        // Load the Lua code
        lauxlib.luaL_loadstring(L, fengari.to_luastring(code));

        // Execute
        if (lua.lua_pcall(L, 0, 1, 0) === lua.LUA_OK) {
            result = lua.lua_tojsstring(L, -1) || '';
        } else {
            result = 'Error executing Lua code.';
        }
    } catch (e) {
        result = 'Exception: ' + e.message;
    }

    // Return result as HTML
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Yeekzy WebUI Executor</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 40px; }
                textarea { width: 100%; height: 200px; font-family: monospace; font-size: 14px; }
                button { padding: 10px 20px; margin-top: 10px; }
                pre { background: #222; color: #0f0; padding: 15px; white-space: pre-wrap; }
                .container { max-width: 800px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px #aaa; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Yeekzy WebUI Executor</h1>
                <form method="POST" action="/execute">
                    <textarea name="code">${code}</textarea><br>
                    <button type="submit">Execute Lua Code</button>
                </form>
                <h2>Result:</h2>
                <pre>${result}</pre>
                <a href="/">Back</a>
            </div>
        </body>
        </html>
    `);
});

// Listen for Vercel environment or fallback
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
