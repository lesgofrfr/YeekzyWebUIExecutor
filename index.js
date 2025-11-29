const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // Add to deps if needed: npm i node-fetch
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Roblox Luau Environment (2025: Lua 5.1 + extras)
const robloxEnv = {
    game: {
        HttpGet: (url) => fetch(url).then(r => r.text()).catch(e => `Error: ${e.message}`),
        Players: { LocalPlayer: { Name: 'Yeekzy' } },
        Workspace: { FilteringEnabled: false }
    },
    getgenv: () => robloxEnv,
    print: (...args) => console.log('[Luau PRINT]', ...args.map(to_jsstring)),
    warn: console.warn,
    error: console.error
};

function executeLuaU(code) {
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    // Inject Roblox globals + Luau polyfills (compound assignment, etc.)
    lauxlib.luaL_dostring(L, to_luastring(`
        _G.game = ${JSON.stringify(robloxEnv.game)}
        _G.getgenv = function() return _G end
        loadstring = function(src)
            local chunk = load(src)
            if chunk then return chunk end
            error("Loadstring failed")
        end
        -- Luau extras polyfill
        local mt = {__index = function(t, k) if k == "and" then return function(a,b) return a and b end end end}
        setmetatable(_G, mt)
        print = function(...) 
            local t = {...}
            for i=1,#t do t[i] = tostring(t[i]) end
            _G._OUTPUT(table.concat(t, "\\t"))
        end
        -- HttpGet async sim (sync wrapper for Lua)
        game.HttpGet = function(url)
            -- Simulate async in sync context (basic)
            return "Sim: " .. url  -- Replace with real fetch if async allowed
        end
    `));

    let output = [];
    let errors = [];

    // Capture output
    lua.lua_pushcclosure(L, (L) => {
        const str = to_jsstring(lua.lua_tostring(L, -1));
        output.push(str);
    }, 0);
    lua.lua_setglobal(L, to_luastring("_OUTPUT"));

    lua.lua_pushcclosure(L, (L) => {
        const str = to_jsstring(lua.lua_tostring(L, -1));
        errors.push(str);
    }, 0);
    lua.lua_setglobal(L, to_luastring("_ERROR"));

    let result = { success: true, output: '', error: '' };

    const status = lauxlib.luaL_dostring(L, to_luastring(code));
    if (status !== lua.LUA_OK) {
        result.success = false;
        result.error = to_jsstring(lua.lua_tostring(L, -1));
    }

    result.output = output.join('\n') || 'Executed (no output)';
    if (errors.length) result.error += '\n' + errors.join('\n');

    lua.lua_close(L);
    return result;
}

app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

app.post('/execute', (req, res) => {
    const code = req.body.code || '';
    const result = executeLuaU(code);

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Yeekzy LuauU v3.0</title>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Roboto+Mono&display=swap">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { background: linear-gradient(135deg, #0a0a0a, #1a1a2e); color: #00ff41; font-family: 'Roboto Mono', monospace; margin: 0; padding: 10px; }
                .container { max-width: 95%; margin: auto; background: #111; padding: 20px; border-radius: 10px; box-shadow: 0 0 20px #00ff41; border: 1px solid #00ff41; }
                h1 { font-family: 'Orbitron'; text-align: center; color: #00ff41; text-shadow: 0 0 15px #00ff41; margin-bottom: 20px; }
                textarea { width: 100%; height: 40vh; min-height: 200px; background: #000; color: #00ff41; border: 1px solid #00ff41; border-radius: 8px; padding: 10px; font-size: 14px; box-sizing: border-box; resize: vertical; }
                .buttons { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
                button { flex: 1; min-width: 100px; background: #00ff41; color: #000; padding: 12px; font-size: 16px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 0 10px #00ff41; touch-action: manipulation; }
                button:hover { background: #00cc33; transform: scale(1.02); }
                button.inject { background: #ff00ff !important; box-shadow: 0 0 15px #ff00ff !important; }
                pre { background: #000; padding: 15px; border: 1px solid #00ff41; border-radius: 8px; margin-top: 10px; color: #00ff41; white-space: pre-wrap; font-size: 12px; max-height: 30vh; overflow-y: auto; }
                .error { color: #ff4444 !important; border-color: #ff4444 !important; }
                @media (max-width: 600px) { .buttons { flex-direction: column; } button { min-width: auto; } }
                footer { text-align: center; margin-top: 15px; font-size: 12px; opacity: 0.7; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>YEEKZY LUAU EXECUTOR v3.0</h1>
                <form method="POST">
                    <textarea name="code" placeholder="print('Yeekzy v3 test!')\nloadstring(game:HttpGet('https://raw.githubusercontent.com/EdgeIY/infiniteyield/master/source'))()">${code.replace(/</g, '&lt;').replace(/"/g, '&quot;')}</textarea><br>
                    <div class="buttons">
                        <button type="submit">Execute</button>
                        <button type="button" class="inject" onclick="injectCode()">Inject (Download + Copy)</button>
                        <button type="button" onclick="clearCode()">Clear</button>
                    </div>
                </form>
                \( {result.success ? `<pre>Output:\n \){result.output.replace(/</g, '&lt;')}</pre>` : `<pre class="error">Error:\n${result.error.replace(/</g, '&lt;')}</pre>`}
                <footer>Mobile-Ready | Fengari Lua 5.3 + Luau Polyfill | Test Script Above</footer>
            </div>
            <script>
                const ta = document.querySelector('textarea');
                ta.value = localStorage.getItem('yeekzy_code') || ta.value;
                ta.oninput = () => localStorage.setItem('yeekzy_code', ta.value);
                
                function injectCode() {
                    const code = ta.value;
                    if (!code) return alert('No code!');
                    const blob = new Blob([code], {type: 'text/plain'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'yeekzy_luau_v3.lua';
                    a.click();
                    navigator.clipboard.writeText(code).then(() => alert('Injected v3! Downloaded + Copied. Load in Executor.'));
                }
                
                function clearCode() {
                    ta.value = '';
                    localStorage.removeItem('yeekzy_code');
                    ta.focus();
                }
            </script>
        </body>
        </html>
    `);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Yeekzy v3.0 Live: http://localhost:${port}`);
});
