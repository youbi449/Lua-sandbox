const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { LuaFactory } = require('wasmoon');

const app = express();
const port = 3000;

// Configuration limits
const MAX_EXECUTION_TIME = 2000; // 2 seconds
const MAX_MEMORY = 50 * 1024 * 1024; // 50 MB
const MAX_PRINT_CALLS = 100;
const MAX_PRINT_LENGTH = 1000;

// Create factory instance
const factory = new LuaFactory();

// Fonction pour créer un environnement Lua sécurisé
async function createSandboxedLua() {
    const lua = await factory.createEngine();

    // Correct retrieval of Lua libraries
    const mathLib = lua.global.get('math');
    const stringLib = lua.global.get('string');
    const tableLib = lua.global.get('table');
    const osLib = lua.global.get('os');
    const debugLib = lua.global.get('debug');

    // Sandbox: Whitelist of allowed functions
    const safeEnv = {
        math: {
            abs: mathLib.abs,
            floor: mathLib.floor,
            ceil: mathLib.ceil,
            random: mathLib.random,
            max: mathLib.max,
            min: mathLib.min,
            sqrt: mathLib.sqrt,
            log: mathLib.log,
            exp: mathLib.exp,
            pi: mathLib.pi,
        },
        string: {
            len: stringLib.len,
            sub: stringLib.sub,
            lower: stringLib.lower,
            upper: stringLib.upper,
            rep: stringLib.rep,
            find: stringLib.find,
            match: stringLib.match,
            gsub: stringLib.gsub,
        },
        table: {
            insert: tableLib.insert,
            remove: tableLib.remove,
            sort: tableLib.sort,
            concat: tableLib.concat,
        },
        os: {
            clock: osLib.clock,
            time: osLib.time,
            date: osLib.date,
        },
        debug: {
            sethook: debugLib.sethook, // Allows execution limiting
        }
    };

    // Apply restricted environment
    lua.global.set('_G', safeEnv);

    return lua;
}

// Définir safeEnv à un niveau global pour l'accès
let globalSafeEnv = null;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());

// Initialisation de l'environnement sécurisé
createSandboxedLua().then(lua => {
    globalSafeEnv = lua.global.get('_G');
});

// Main route to serve the interface
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Route to execute Lua code
app.post('/execute', async (req, res) => {
    try {
        console.log('Request received:', req.body);
        
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({
                error: 'Invalid request body'
            });
        }

        const { code } = req.body;
        console.log('Code received:', code);

        if (!code || typeof code !== 'string') {
            return res.status(400).json({
                error: 'Lua code must be a non-empty string'
            });
        }

        if (code.length > 1000) {
            return res.status(400).json({
                error: 'Code exceeds 1000 character limit'
            });
        }

        // Create a new Lua instance for each request
        const lua = await createSandboxedLua();

        // Output management with limits
        let printCount = 0;
        let output = '';
        lua.global.set('print', (...args) => {
            if (printCount >= MAX_PRINT_CALLS) {
                throw new Error('Maximum number of print calls exceeded');
            }
            const printStr = args.join('\t') + '\n';
            if (printStr.length > MAX_PRINT_LENGTH) {
                throw new Error('Excessive print output length');
            }
            output += printStr;
            printCount++;
        });

        // Execution with timeout
        const executionPromise = lua.doString(code);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Execution timeout exceeded')), MAX_EXECUTION_TIME);
        });

        try {
            await Promise.race([executionPromise, timeoutPromise]);
            console.log('Execution successful, output:', output);
            res.json({ output });
        } catch (error) {
            console.log('Execution error:', error.message);
            res.status(400).json({ error: error.message });
        } finally {
            // Cleanup
            await lua.global.close();
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            error: 'Error executing code: ' + error.message
        });
    }
});

// Route pour envoyer la liste des fonctions autorisées
app.get('/allowed-functions', (req, res) => {
    if (!globalSafeEnv) {
        return res.status(500).json({ error: 'Environnement Lua non initialisé' });
    }
    const allowedFunctions = Object.fromEntries(
        Object.entries(globalSafeEnv).map(([lib, funcs]) => [
            lib,
            Object.keys(funcs)
        ])
    );
    res.json(allowedFunctions);
});

app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
}); 