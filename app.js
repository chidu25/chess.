// Chess App with chess-api.com integration
const game = new Chess();
let selected Square = null;
let gameHistory = JSON.parse(localStorage.getItem('gameHistory')) || [];
let isAIThinking = false;
const PIECES = {w:{K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙'},b:{K:'♚',Q:'♛',R:'♜',B:'♝',N:'♞',P:'♟︎'}};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initBoard();
    setupEventListeners();
    renderGameHistory();
});

function initBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    for(let row = 0; row < 8; row++) {
        for(let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.square = String.fromCharCode(97 + col) + (8 - row);
            square.onclick = () => handleSquareClick(square.dataset.square);
            board.appendChild(square);
        }
    }
    updateBoard();
}

function updateBoard() {
    const squares = document.querySelectorAll('.square');
    squares.forEach(sq => {
        sq.textContent = '';
        sq.classList.remove('selected', 'highlight');
        const piece = game.get(sq.dataset.square);
        if(piece) sq.textContent = PIECES[piece.color][piece.type.toUpperCase()];
    });
    updateStatus();
}

function handleSquareClick(square) {
    if(game.game_over() || isAIThinking) return;
    
    // Only allow white (human) to move
    if(game.turn() !== 'w') return;
    
    if(!selectedSquare) {
        const piece = game.get(square);
        // Only allow selecting white pieces
        if(piece && piece.color === 'w') {
            selectedSquare = square;
            document.querySelector(`[data-square="${square}"]`).classList.add('selected');
            highlightMoves(square);
        }
    } else {
        const move = game.move({from: selectedSquare, to: square, promotion: 'q'});
        if(move) {
            selectedSquare = null;
            document.querySelectorAll('.square').forEach(s => s.classList.remove('selected', 'highlight'));
            updateBoard();
            if(!game.game_over()) {
                setTimeout(() => getAIMove(), 500);
            }
        } else {
            selectedSquare = null;
            document.querySelectorAll('.square').forEach(s => s.classList.remove('selected', 'highlight'));
        }
    }
}

function highlightMoves(square) {
    const moves = game.moves({square, verbose: true});
    moves.forEach(m => {
        document.querySelector(`[data-square="${m.to}"]`).classList.add('highlight');
    });
}

async function getAIMove() {
    if(game.game_over() || isAIThinking) return;
    isAIThinking = true;
    const depth = document.getElementById('aiDepth').value;
    try {
        document.getElementById('status').textContent = 'AI thinking...';
        const response = await fetch('https://chess-api.com/v1', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({fen: game.fen(), depth: parseInt(depth)})
        });
        const data = await response.json();
        if(data.move) {
            game.move(data.move);
            updateBoard();
            displayEvaluation(data);
            saveGame();
        }
    } catch(err) {
        console.error('AI move error:', err);
        document.getElementById('status').textContent = 'AI error - your turn';
    } finally {
        isAIThinking = false;
    }
}

function displayEvaluation(data) {
    const evalDiv = document.getElementById('evaluation');
    if(data.eval !== undefined) {
        evalDiv.textContent = `Eval: ${data.eval > 0 ? '+' : ''}${data.eval.toFixed(2)} | Depth: ${data.depth}`;
        if(data.text) evalDiv.textContent += ` | ${data.text}`;
    }
}

function updateStatus() {
    const status = document.getElementById('status');
    if(game.in_checkmate()) status.textContent = game.turn() === 'w' ? 'Black wins!' : 'White wins!';
    else if(game.in_draw()) status.textContent = 'Draw!';
    else if(game.in_check()) status.textContent = `Check! ${game.turn() === 'w' ? 'White' : 'Black'} to move`;
    else status.textContent = `${game.turn() === 'w' ? 'White' : 'Black'} to move`;
    
    const moves = game.history();
    document.getElementById('moveList').innerHTML = moves.map((m,i) => 
        i % 2 === 0 ? `<div>${Math.floor(i/2) + 1}. ${m}` : `${m}</div>`
    ).join('');
}

function saveGame() {
    const pgn = game.pgn();
    if(pgn && game.game_over()) {
        gameHistory.unshift({pgn, date: new Date().toISOString(), result: game.header().Result || '*'});
        if(gameHistory.length > 20) gameHistory = gameHistory.slice(0, 20);
        localStorage.setItem('gameHistory', JSON.stringify(gameHistory));
        renderGameHistory();
    }
}

function setupEventListeners() {
    document.getElementById('newGame').onclick = () => {
        game.reset();
        isAIThinking = false;
        selectedSquare = null;
        initBoard();
    };
    
    document.getElementById('undoMove').onclick = () => {
        if(!isAIThinking) {
            game.undo();
            game.undo();
            updateBoard();
        }
    };
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab);
    });
    
    document.getElementById('analyzeBtn').onclick = analyzePosition;
    document.getElementById('loadCurrent').onclick = () => {
        document.getElementById('fenInput').value = game.fen();
    };
    
    document.getElementById('clearHistory').onclick = () => {
        if(confirm('Clear all game history?')) {
            gameHistory = [];
            localStorage.removeItem('gameHistory');
            renderGameHistory();
        }
    };
    
    document.getElementById('exportPGN').onclick = () => {
        const pgns = gameHistory.map(g => g.pgn).join('\n\n');
        const blob = new Blob([pgns], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'chess-games.pgn';
        a.click();
    };
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(tab).classList.add('active');
}

async function analyzePosition() {
    const fen = document.getElementById('fenInput').value || game.fen();
    const output = document.getElementById('analysisOutput');
    try {
        output.textContent = 'Analyzing...';
        const response = await fetch('https://chess-api.com/v1', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({fen, depth: 15, variants: 3})
        });
        const data = await response.json();
        output.innerHTML = `<h4>Best Move: ${data.move}</h4><p>${data.text}</p><p>Evaluation: ${data.eval}</p><p>Continuation: ${data.continuationArr ? data.continuationArr.join(' → ') : 'N/A'}</p>`;
        renderAnalysisBoard(fen);
    } catch(err) {
        output.textContent = 'Analysis error: ' + err.message;
    }
}

function renderAnalysisBoard(fen) {
    const tempGame = new Chess(fen);
    const board = document.getElementById('analysisBoard');
    board.innerHTML = '';
    for(let row = 0; row < 8; row++) {
        for(let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            const sq = String.fromCharCode(97 + col) + (8 - row);
            const piece = tempGame.get(sq);
            if(piece) square.textContent = PIECES[piece.color][piece.type.toUpperCase()];
            board.appendChild(square);
        }
    }
}

function renderGameHistory() {
    const container = document.getElementById('gameHistory');
    if(gameHistory.length === 0) {
        container.innerHTML = '<p>No games played yet.</p>';
        return;
    }
    container.innerHTML = gameHistory.map((g, i) => `
        <div style="border:1px solid #ddd;padding:15px;margin:10px 0;border-radius:5px;background:white">
            <strong>Game ${i + 1}</strong> - ${new Date(g.date).toLocaleString()}<br>
            Result: ${g.result}<br>
            <details><summary>View PGN</summary><pre>${g.pgn}</pre></details>
        </div>
    `).join('');
}
