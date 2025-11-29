const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require('path');
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

async function runLuaU(code) {
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    let output = [];
    let errors = [];

    // Capture print()
    lua.lua_pushcfunction(L, lua.lua_print = (L) => {
        const n = lua.lua_gettop(L);
        let str = '';
        for (let i = 1; i <= n; i++) {
            str += to_jsstring(lua.lua_tostring(L, i)) + (i < n ? '\t' : '');
        }
        output.push(str);
        return 0;
    });
    lua.lua_setglobal(L, to_luastring('print'));

    // HttpGet (real fetch)
    lua.lua_pushcfunction(L, async (L) => {
        const url = to_jsstring(lua.lua_tostring(L, 1));
        try {
            const res = await fetch(url);
            const text = await res.text();
            lua.lua_pushstring(L, to_luastring(text));
        } catch (e) {
            lua.lua_pushstring(L, to_luastring('HttpGet failed: ' + e.message));
        }
        return 1;
    });
    lua.lua_setglobal(L, to_luastring('HttpGet'));

    // Basic Roblox env
    lauxlib.luaL_dostring(L, to_luastring(`
        game = { HttpGet = HttpGet }
        getgenv = function() return _G end
        loadstring = load
    `));

    let result = { success: true, output: '', error: '' };

    try {
        if (lauxlib.luaL_dostring(L, to_luastring(code)) !== lua.LUA_OK) {
            result.success = false;
            result.error = to_jsstring(lua.lua_tostring(L, -1));
        }
    } catch (e) {
        result.success = false;
        result.error = e.message || 'Runtime error';
    }

    result.output = output.join('\n') || 'Executed (no output)';
    if (errors.length) result.error += '\n' + errors.join('\n');

    lua.lua_close(L);
    return result;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/execute', async (req, res) => {
    const code = req.body.code || '';
    const result = await runLuaU(code);

    res.sendFile(path.join(__dirname, 'public', 'index.html')); // We'll show
