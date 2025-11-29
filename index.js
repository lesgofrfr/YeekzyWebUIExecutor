const express = require('express');
const bodyParser = require('body-parser');
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari-web');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const ROBLOX_GENV = {}; // Simulates getgenv()

function executeLuaU(code) {
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    // === Roblox globals
    lua.lua_newtable(L);
    lua.lua_setglobal(L, to_luastring("getgenv"));
    lauxlib.luaL_dostring(L, to_luastring(`
        getgenv = function() return _G end
        loadstring = function(src)
            local fn, err = load(src)
            if fn then return fn end
            error(err)
        end
        print = function(...) 
            local args = table.pack(...)
            for i=1,args.n do args[i] = tostring(args[i]) end
            _G._PRINT(table.concat(args, "\t"))
        end
        warn = print
        error = function(msg) _G._ERROR(tostring(msg)) end
    `));

    // Capture print/error
    let output = [];
    let errors = [];

    lua.lua_pushjsstring(L, (str) => output.push(str));
    lua.lua_setglobal(L, to_luastring("_PRINT"));

    lua.lua_pushjsstring(L, (str) => errors.push(str));
    lua.lua_setglobal(L, to_luastring("_ERROR"));

    let result = { success: true, output: "", error: "" };

    try {
        const status = lauxlib.luaL_dostring(L, to_luastring(code));
        if (status !== lua.LUA_OK) {
            result.success = false;
            result.error = to_jsstring(lua.lua_tostring(L, -1));
        }
    } catch (e) {
        result.success = false;
        result.error = e.message || "Unknown error";
    }

    result.output = output.join("\n");
    if (errors.length > 0) {
        result.success = false;
        result.error += "\n" + errors.join("\n");
    }

    lua.lua_close(L);
    return result;
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.post('/execute', (req, res) => {
    const code = req.body.code || '';
    const result = executeLuaU(code);

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Yeekzy Executor</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Roboto+Mono&display=swap">
        <style>
            body { background: #0d0d0d; color: #0f0; font-family: 'Roboto Mono'; margin:0; padding:20px; }
            .container { max-width: 900px; margin: auto; background:#111; padding:25px; border-radius:15px; box-shadow:0 0 30px #0f0; border:2px solid #0f0; }
            h1 { font-family: 'Orbitron'; text-align:center; color:#0f0; text-shadow:0 0 20px #0f0; }
            textarea { width: width:100%; height:300px; background:#000; color:#0f0; border:2px solid #0f0; border-radius:10px; padding:15px; font-size:16px; }
            button { background:#0f0; color:#000; padding:15px 40px; font-size:18px; border:none; border-radius:10px; cursor:pointer; font-weight:bold; box-shadow:0 0 20px #0f0; }
            button:hover { background:#0c0; transform:scale(1.05); }
            pre { background:#000; padding:20px; border:2px solid #0f0; border-radius:10px; margin-top:20px; color:#0f0; white-space:pre-wrap; }
            .inject { background:#ff00ff !important; box-shadow:0 0 30px #f0f !important; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>YEEKZY LUAU EXECUTOR</h1>
            <form method="POST">
                <textarea name="code" placeholder="print('Hello from Yeekzy Executor!')\n\nloadstring(game:HttpGet('https://raw.githubusercontent.com/...'))()">${code.replace(/</g, '&lt;')}</textarea><br><br>
                <button type="submit">Execute</button>
                <button type="button" class="inject" onclick="inject()">INJECT</button>
            </form>
            \( {result.success ? `<pre>Output:\n \){result.output || 'No output'}</pre>` : `<pre style="color:#f00;">Error:\n${result.error}</pre>`}
        </div>
        <script>
            function inject() {
                const code = document.querySelector('textarea').value;
                if (!code) return alert("No code to inject!");
                const blob = new Blob([code], {type: 'text/plain'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'yeekzy_inject.lua';
                a.click();
                alert("INJECTED! Save as .lua and drag into your executor (Krnl, Fluxus, Solara)");
            }
        </script>
    </body>
    </html>
    `);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Yeekzy Executor running → http://localhost:${port}`);
});
