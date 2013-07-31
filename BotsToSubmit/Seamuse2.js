/*
 * Default Bot Behavior
 * 
 * createBot(log):
 *      defines the constructor and closure scope for your bot. All local variables and functions
 *      must be defined within the body of createBot(log).
 * "log" parameter:
 *      is a logging function passed to your bot that you
 *      can use to output messages to the browser debugging console.
 *      Its signature is log(message) where message is any string.
 * returns:
 *      an object 
 *      {
 *          name // your bot's name
 *          doBehavior // the function that executes your bot's behavior every frame
 *      }
 *
 *  doBehavior is the function that executes your bot's behavior every frame. Its signature is function (player, players, grid, message).
 * "player" parameter:
 *      your bot's player object:
 *      {
 *          id // your player's team id, an integer (1 - n; n == number of players, assigned randomly to you on startup)
 *          col // your player's current tile column; an integer (0 - 19)
 *          row // your player's current tile row; an integer (0 - 15)
 *          boost // your player's current boost rate; an integer (0 - 3)
 *          boostUsed // amount of boost used; an integer (0 - 50)
 *      }
 * "players" parameter:
 *      an array of all players on the board (including you)
 * "grid" parameter:
 *      a two-dimensional array of tiles as grid[row][column]
 *      a tile is:
 *      {
 *          col // tile's column; an integer (0 - 19)
 *          row // tile's row; an integer (0 - 15)
 *          type // the shape type; an integer (0 - 3 for the shapes, -1 for empty tile)
 *          team // which player currently owns it (team id); an integer (0 == not owned, 1 - n; n == number of players)
 *          strength // degree of fortification by a player; an integer (0 == not fortified, 1 == fortified)
 *          ticks // progress towards tile operation (claiming, fortifying, attacking, etc) (0 - goalTicks)
 *          goalTicks // number of ticks required for tile operation success
 *          tickTeam // player team id who is currently making tick progress on the tile (0 == 1 or more players are canceling each other out, 1 - n; n == number of players)
 *          visitors // array of player objects currently occupying the tile
 *          nodeId // unique id of the tile (0 - 319)
 *      }
 * "message" parameter:
 *      you have the ability to send messsages to your bot using the game UI. messages are not sent immediately
 *      but are passed to your bot at a predefined interval. the message will show up for one frame. use the "persistentStore"
 *      global variable if you wish to persist messages for more than one frame.
 * "framesLeft" parameter:
 *      the number of frames left before the shape chains are banked and scored. 0 denotes the final frame before banking.
 *      this value will be approximate due to limitation of browser timing, but will never be < 0.
 * returns:
 *      doBehavior must return the updated state of your player as an object:
 *      {
 *          outX: the x-position (column) of your player; an integer (0 - 19)
 *          outY: the y-position (row) of your player; an integer (0 - 15)
 *          outB: the boost rate to use; an integer (0 - 3)
 *      }
 *
 * persistentStore:
 *      global variable. a personal data store for your bot, begins as an empty object.
 *      this object can be used to store state between frames for the duration of the game.
*/

function createBot(log) {

    // Your Bot's name
    var botName = 'Seamuse2';
    var debug = 0;
    var workGrid = [];
    var moveTiles = [];
    var gridRows = 16;
    var gridCols = 20;
    var maxFight = 20;

    // offset values for neighboring tiles as [row, column] pairs
    var neighborOffsets = [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]];

    // MISC
    function displayDebugMessage(level, message) {
        switch (level) {
            case 1:
                if (debug == 1 || debug == 3 || debug == 6) log(message);
                break;
            case 2:
                if (debug == 2 || debug == 3 || debug == 7) log(message);
                break;
            case 4:
                if (debug == 4) log(message);
                break;
            case 5:
                if (debug == 5) log(message);
                break;
            default:
                break;
        }
    }
    function displayWorkData(level, message, player, grid, store, framesLeft) {
        var tile = workGrid[player.row][player.col];
        displayDebugMessage(level, message + player.id +
            ':CL' + tile.myChainLength +
            '***[' + player.row + ',' + player.col + ']' +
            framesLeft + ',' + store.maxFight +
            ' B:' + player.boost + ',' + player.boostUsed +
            ' Team:' + tile.team +
            ' Visitors:' + tile.numVisitors +
            ' Ticks/Goal/tickTeam: ' + Math.floor(tile.ticks) + '/' +
            tile.goalTicks + '/' +
            tile.tickTeam +
            ' OwnedBy{' + tile.tilesNotOwned + ',' +
            tile.tilesOwnedByTeam + ',' +
            tile.tilesOwnedByOther + '} Neigbors:' +
            tile.numMyConnections);
    }
    // an extension method on object to enumerate its properties as name-value pairs (like a dictionary)
    function getKeys(object) {
        var keys = [];
        for (var i in object)
            if (object.hasOwnProperty(i)) {
                keys.push(i);
            }
        return keys;
    }
    function getVisitors(tile, player) {
        var visitorKeys = getKeys(tile.visitors);
        var playerIds = [];

        if (visitorKeys.length > 0) {
            for (var i = 0, j = 0; i < visitorKeys.length; ++i) {
                var key = visitorKeys[i];
                var vPlayer = tile.visitors[key];

                if (player.id !== vPlayer.id) {
                    playerIds[j++] = vPlayer.id;
                }
            }
        }

        return playerIds;
    }
    function getRandomTileForPlayer(location, player) {
        player.col = Math.floor(Math.random() * 20);
        player.row = Math.floor(Math.random() * 16);
        displayDebugMessage(1, 'Random Select[' + player.row + ',' + player.col + ']' + location);

        return true;
    }
    function validTile(row,col)
    {
        if (row > -1 & row < 16 && col > -1 && col < 20) return true;
        return false;
    }
    function checkForNeighborOffsetTileByTeam(grid, player) {
        var done = false;

        neighborOffsets.forEach(function (n) {
            if (!done) {
                var r = player.row + n[0];
                var c = player.col + n[1];
                if (validTile(r, c)) {
                    if (grid[r][c].type != -1 && grid[r][c].team != player.id && grid[r][c].team == 0) {

                        displayDebugMessage(1, 'neighborOffset Select[' + r + ',' + c + '] NoTeam');

                        player.row = r;
                        player.col = c;
                        done = true;
                    }
                }
            }
        });

        return done;
    }
    function getStage(max, count) {
        var stage2;
        switch (persistentStore.gameType) {
            case 1: // mini cycle(10)
                var stage2 = 0;
                break;
            case 2: // Short cycle(20)
                var stage2 = .2 * max;
                break;
            case 3: // medium cycle(30)
                var stage2 = .3 * max;
                break;
            case 4: // long cycle(60)
                var stage2 = .2 * max;
                break;
            default: // longgggggg cycle(>60)
                var stage2 = .2 * max;
                break;
        }

        if (count > stage2) {
            return 2;
        }

        return 1;
    }
    function setGameType(framesLeft) {
        var gameType = 5; // longgggg rebank
        if (framesLeft < 100) {
            gameType = 1; // short 10 second rebank
        }
        else {
            if (framesLeft < 200) {
                gameType = 2; // short 20 second rebank
            }
            else {
                if (framesLeft < 300) {
                    gameType = 3; // short 30 second rebank
                }
                else {
                    if (framesLeft < 600) {
                        gameType = 4; // short 60 second rebank
                    }
                }
            }
        }

        return gameType;
    }
    function setPlayerBoost(grid, player, players) {
        if ((player.row === -1) || (player.col === -1)) {
            if (player.boostUsed < 20) {
                player.boost = 2;
            }
            else {
                player.boost = 0;
            }
        }
        else {
            var tile = grid[player.row][player.col];

            if (tile.numVisitors === 0) {
                if (player.boostUsed <20) {
                    player.boost = 2;
                }
                else {
                    player.boost = 0;
                }
            }
            else {
                var visitor1= getPlayer(players, tile.visitorsIds[0]);
                
                if (player.boostUsed < visitor1.boostUsed && tile.ticks < tile.goalTicks) {
                    player.boost = 3;
                }
                else {
                    player.boost = 0;
                }
            }
        }
    }
    // MISC

    // CHAINS
    function findChain(grid, player, row, col) {
        var chainTile = grid[row][col];
        var tiles = [];
        var visitedTiles = {};
        var totalTeamTileCount = 0;
        var addNeighbors = false;

        if (chainTile.type != -1) {
            tiles.push(chainTile);

            while (tiles.length > 0) {
                var tile = tiles.pop();
                addNeighbors = false;

                if (visitedTiles[tile.id] !== undefined) {
                    continue;
                }

                visitedTiles[tile.id] = true;
                chainTile.myChain.push(tile);
                if (tile.team == player.id) totalTeamTileCount++;
                if (tile.myConnections.length === 0) addNeighbors = true;

                for (var neighbor = 0; neighbor < 8; ++neighbor) {

                    var neighborRow = tile.row + neighborOffsets[neighbor][0];
                    var neighborCol = tile.col + neighborOffsets[neighbor][1];

                    if (validTile(neighborRow, neighborCol)) {
                        var neighborTile = grid[neighborRow][neighborCol];

                        if (neighborTile.type == tile.type) {
                            tiles.push(neighborTile);
                            if (addNeighbors) {
                                tile.myConnections.push(neighborTile);
                            }
                        }
                    }
                }
            }
        }

        return totalTeamTileCount;
    }
    function findAllChains(grid, player)
    {
        workGrid = createMyGrid(grid, gridRows, gridCols);

        for (var row = 0; row < gridRows; row++) {
            for (var col = 0; col < gridCols; col++) {
                var chainTile = workGrid[row][col];
                if (chainTile.myChainLength === -1) {
                    chainTile.tilesOwnedByTeam = findChain(workGrid, player, row, col);
                    chainTile.myChainLength = chainTile.myChain.length;
                    chainTile.numMyConnections = chainTile.myConnections.length;
                    chainTile.stage = getStage(8, chainTile.myChainLength);
                    chainTile.visitorsIds = getVisitors(chainTile, player);
                    chainTile.numVisitors = chainTile.visitorsIds.length;

                    for (var cell = 0; cell < chainTile.myChainLength; cell++) {
                        tile = chainTile.myChain[cell];

                        if (tile.team == 0) {
                            chainTile.tilesNotOwned++;
                        }
                        else {
                            if (tile.team != player.id) {
                                chainTile.tilesOwnedByOther++;
                            }
                        }
                    }
                }
            }
        }

        printGrid(grid, true);
        printGrid(workGrid, false);
    }

    function playersOnThisChain(chain, chainLength) {
        var count = 0;

        if (chain !== undefined) {
            for (var tile = 0; tile < chainLength; tile++) {
                var chainTile = chain[tile];
                if (chainTile.numVisitors > count) {
                    count = chainTile.numVisitors;
                }
            }
        }

        return count;
    }
    function findChainOwnedByOthers(workGrid, player) {
        var done = false;

        for (var row = 0; row < gridRows && !done; row++) {
            for (var col = 0; col < gridCols && !done; col++) {
                var chainTile = workGrid[row][col];
                if ((chainTile.tilesOwnedByOther == chainTile.myChainLength) && (chainTile.myChainLength > 3) && chainTile.numVisitors == 0) {
                    player.row = chainTile.row;
                    player.col = chainTile.col;
                    done = true;
                }
            }
        }
        return done;
    }

    function getBestChain(player, stage) {
        var longest = 0;
        var done = false;
        var tilesOwnedByTeamLimit = 2;
        var foundTile;
        var rowList;
        var colList;

        if (stage == 1) {
            rowList = { b: 13, c: 11, d: 9, e: 7, f: 5, g: 1, h: 14, i: 12, j: 10, k: 8, l: 6, m: 4, n: 2 }
            colList = { y: 17, a: 15, b: 13, c: 11, d: 9, e: 7, f: 5, g: 1, x: 18, w: 16, h: 14, i: 12, j: 10, k: 8, l: 6, m: 4, n: 2 }
        }
        else {
            //rowList = { a: 15, b: 13, c: 11, d: 9, e: 7, f: 5, g: 1, h: 14, i: 12, j: 10, k: 8, l: 6, m: 4, n: 2, o: 0 }
            //colList = { z: 19, y: 17, a: 15, b: 13, c: 11, d: 9, e: 7, f: 5, g: 1, x: 18, w: 16, h: 14, i: 12, j: 10, k: 8, l: 6, m: 4, n: 2, o: 0 }
            rowList = { b: 13, c: 11, d: 9, e: 7, f: 5, g:3, i: 12, j: 10, k: 8, l: 6, m: 4, n: 2 }
            colList = { y: 17, a: 15, b: 13, c: 11, d: 9, e: 7, f: 5, g:3, w: 16, h: 14, i: 12, j: 10, k: 8, l: 6, m: 4, n: 2 }
        }

        try {
            //for (var row = 0; row < gridRows && !done; row++) {
            //    for (var col = 0; col < gridCols && !done; col++) {
            for (rrr in rowList) {
                for (ccc in colList) {
                    row = rowList[rrr];
                    col = colList[ccc];
                    var chainTile = workGrid[row][col];

                    if (chainTile.myChainLength > 0) {
                        if (chainTile.myChainLength > longest &&
                            ((chainTile.tilesOwnedByTeam > chainTile.tilesOwnedByOther) || (chainTile.tilesOwnedByOther == 0)) &&
                            (chainTile.tilesNotOwned > 0)) {
                            longest = chainTile.myChainLength;
                            foundTile = chainTile;
                            if (stage == 2) {
                                if (longest > 3) {
                                    done = true;
                                }
                            }
                            else {
                                if (longest > tilesOwnedByTeamLimit) {
                                    done = true;
                                }
                            }
                        }
                    }
                }
            }

            if (done) {
                displayDebugMessage(2, 'BEST chainTile Select[' + foundTile.row + ',' + foundTile.col + ']' +
                    foundTile.myChainLength + '  Visitors:' + foundTile.numVisitors);

                player.row = foundTile.row;
                player.col = foundTile.col;
            }
            else {
                displayDebugMessage(1, 'NO BEST chainTile WAS FOUND.')
            }
        }
        catch (e) {
            log('ERROR IN GET BEST ' + e.message);
        }

        return done;
    }
    function getNextChainedTile(player, tile)
    {
        var done = false;
        var chainTile = workGrid[tile.row][tile.col];

        if (chainTile !== undefined && chainTile.myChainLength > 2) {
            if ((chainTile.type != -1) && (playersOnThisChain(chainTile.myChain, chainTile.myChainLength) < 3)) {
                var maxConnections = (chainTile.myChainLength > 8 ? 8 : chainTile.myChainLength);
                for (var connections = maxConnections; connections > 0 && !done; connections--) {
                    for (var cell = chainTile.myChainLength-1; cell > 0 && !done; cell--) {
                        var popTile = chainTile.myChain[cell];
                        if (popTile.numMyConnections != connections) continue;
                        if (popTile.team == player.id) continue;
                        if (popTile.row == tile.row && popTile.col == tile.col) continue;
                        if (popTile.numVisitors > 0) return done;

                        if (popTile.type != -1) {

                            displayDebugMessage(1, 'chainTile Select[' + popTile.row + ',' + popTile.col + ']' +
                                chainTile.myChainLength + '  Visitors:' + workGrid[popTile.row][popTile.col].numVisitors);

                            player.row = popTile.row;
                            player.col = popTile.col;
                            done = true;
                        }
                    }
                }
            }
        }

        return done;
    }

    function checkForNeighborOffsetTileByTypeIfNoChainTiles(grid, store, player, myTile) {
        var done = false;

        if (store.myChainTiles === undefined) {
            var myType = myTile.type;
            neighborOffsets.forEach(function (n) {
                if (!done) {
                    var r = player.row + n[0];
                    var c = player.col + n[1];
                    if (validTile(r, c)) {
                        if (grid[r][c].type != -1 && grid[r][c].team != player.id && grid[r][c].type == myType) {

                            displayDebugMessage(1, 'No Chain neighborOffset Select[' + r + ',' + c + '] MyType::' +
                                grid[r][c].type + ':' + myType);

                            player.row = r;
                            player.col = c;
                            done = true;
                        }
                    }
                }
            });
        }

        return done;
    }
    // CHAINS

    // CORE TILES
    function addCoreTiles(grid, core) {
        core.push(grid[2][2]);
        core.push(grid[2][5]);
        core.push(grid[2][8]);
        core.push(grid[2][11]);
        core.push(grid[2][14]);
        core.push(grid[2][17]);
        core.push(grid[5][2]);
        core.push(grid[5][5]);
        core.push(grid[5][8]);
        core.push(grid[5][11]);
        core.push(grid[5][14]);
        core.push(grid[5][17]);
        core.push(grid[8][2]);
        core.push(grid[8][5]);
        core.push(grid[8][8]);
        core.push(grid[8][11]);
        core.push(grid[8][14]);
        core.push(grid[8][17]);
        core.push(grid[11][2]);
        core.push(grid[11][5]);
        core.push(grid[11][8]);
        core.push(grid[11][11]);
        core.push(grid[11][14]);
        core.push(grid[11][17]);
        core.push(grid[14][2]);
        core.push(grid[14][5]);
        core.push(grid[14][8]);
        core.push(grid[14][11]);
        core.push(grid[14][14]);
        core.push(grid[14][17]);
    }
    function getRandomSeed(grid,core,player)
    {
        var done = false;
        var next;
        var coreTile;
        var tile;
        var coreCount = 30;

        var loopCount = coreCount;
        while (!done && loopCount > 0) {
            loopCount--;
            next = Math.floor(Math.random() * coreCount);
            coreTile = core[Math.floor(Math.random() * coreCount)];

            tile = grid[coreTile.row][coreTile.col];
            if (tile.type != -1 && tile.team !== player.id && tile.numVisitors < 1) {
                displayDebugMessage(1, 'Core Tile[' + tile.row + ',' + tile.col + '] was selected.');
                player.row = tile.row;
                player.col = tile.col;
                done = true;
            }
        }

        return done;
    }
    function getRandomSeedTile(grid,tiles,player)
    {
        var done = false;
        var tile;
        var tileCount = tiles.length;

        var loopCount = tileCount;
        while (!done && tileCount > 0) {
            tileCount--;
            var unused = Math.floor(Math.random() * tileCount);
            tile = tiles[Math.floor(Math.random() * tileCount)];

            if (tile.type != -1 && tile.team !== player.id && tile.numVisitors < 1) {
                displayDebugMessage(1, 'RANDOM workTile[' + tile.row + ',' + tile.col + '] was selected.');
                player.row = tile.row;
                player.col = tile.col;
                done = true;
            }
        }

        return done;
    }
    // CORE TILES

    // MESSAGES
    function pauseOrResume(store, message) {
        if (store.stop === undefined) store.stop = false;
        if (message !== undefined) {
            if (message === 'pause') {
                store.stop = true;
            }
            else {
                if (message.indexOf('debug') != -1) debug = parseInt(message.replace('debug', ''), 10);
                store.stop = false;
            }
        }

        return store.stop;
    }
    // MESSAGES

    // GRID
    function createMyGrid(grid, maxRow, maxCol)
    {
        // type = -1 to 3
        var newGrid = [];
        for (var row = 0; row < maxRow; row++) {
            newGrid[row] = [];
            for (var col = 0; col < maxCol; ++col) {
                newGrid[row][col] = grid[row][col];
                newGrid[row][col].myChain = [];
                newGrid[row][col].myChainLength = -1;
                newGrid[row][col].myConnections = [];
                newGrid[row][col].numMyConnections = 0;
                newGrid[row][col].visitorsIds = 0;
                newGrid[row][col].numVisitors = 0;
                newGrid[row][col].tilesNotOwned = 0;
                newGrid[row][col].tilesOwnedByTeam = 0;
                newGrid[row][col].tilesOwnedByOther = 0;
                newGrid[row][col].stage = 0;
            }
        }

        return newGrid;
    }
    function createMoveTiles(grid,tiles){
        for (var row = 0; row < gridRows; row++) {
            tiles.push(grid[row][gridRows-1]);
            tiles.push(grid[row][0]);
        }
        for (var col = 1; col < gridCols-1; col++) {
            tiles.push(grid[gridRows-1][col]);
            tiles.push(grid[0][col]);
        }
    }
    function printGrid(grid, type) {
        var maxRow = 16;
        var maxCol = 20;
        var printString = '';

        for (var row = 0; row < maxRow; row++) {
            printString += 'Row' + row + '  ';
            if (type) {
                for (var col = 0; col < maxCol; col++) {
                    printString += grid[row][col].type + ':' + grid[row][col].team + '  ';
                }
            }
            else {
                for (var col = 0; col < maxCol; ++col) {
                    for (var col = 0; col < maxCol; col++) {
                        printString += grid[row][col].type + ':' + grid[row][col].team + ':' + grid[row][col].myChainLength + '  ';
                    }
                }
            }
            displayDebugMessage(4, printString);
            printString = '';
        }
    }
    // GRID

    // GAMES
    function startGame(player, players, grid, message, framesLeft) {
        var done = false;

        if (!persistentStore.initialized) {
            persistentStore.maxFight = maxFight;
            persistentStore.framesLeft = 0;
            persistentStore.bankCount = 0;

            // Set up core tiles to be taken and retained
            //
            persistentStore.coreTiles = [];
            addCoreTiles(grid, persistentStore.coreTiles);

            // Set game type
            persistentStore.gameType = setGameType(framesLeft)

            persistentStore.initialized = true;
        }

        // If Bank occurred, clear local banked tiles and chained tiles
        if (persistentStore.framesLeft < framesLeft) {
            persistentStore.maxFrames = framesLeft;
            persistentStore.bankCount++;
            displayDebugMessage(5, 'Bank count is ' + persistentStore.bankCount);
        }

        // your player was on a tile when it was banked by another team and you
        // have been momentarily moved off the grid
        if ((player.row === -1) || (player.col === -1)) {
            // Can only occur after bank
            persistentStore.maxFight = maxFight;
            if (getRandomSeed(grid, persistentStore.coreTiles, player)) {
                player.boost = 0;
                displayDebugMessage(2, 'RETURN core tile PLAYER[' + player.row + ',' + player.row + ',B' + player.boost + ']');
                done = true;
            }

            // backup
            if (!done) {
                while ((player.row === -1) || (player.col === -1) || (grid[player.row][player.col].type === -1)) {
                    getRandomTileForPlayer('TOP', player);
                }
                player.boost = 0;
                displayDebugMessage(2, 'RETURN TOP RANDOM PLAYER[' + player.row + ',' + player.row + ',B' + player.boost + ']');
                done = true;
            }
        }

        if (!done) {
            // Find all chains
            // and indicate whether unclaimed, mine, other
            findAllChains(grid, player);
            createMoveTiles(workGrid, moveTiles);
        }

        return done;
    }
    function getPlayer(players, id) {
        for (var i = 0; i < players.length; i++) {
            if (players[i].id == id) {
                return players[i];
            }
        }

        return players[0];
    }
    function getNewTileMini(grid, player, players) {
        var getNewFlag = false;
        var myTile = grid[player.row][player.col];
        var visitor1;
        var FORTIFY = 5;
        var sel = 0;

        if (myTile.numVisitors > 0) {
            visitor1 = getPlayer(players, myTile.visitorsIds[0]);
        }

        if (persistentStore.maxFight < 0) {
            getNewFlag = true;
            sel = 1;
        }
        else {
            if (myTile.numVisitors == 0) {
                // NO VISITORS
                if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.numMyConnections < FORTIFY)) {
                    getNewFlag = true;
                    sel = 7;
                }
                else{
                    if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.strength == 1)) {
                        getNewFlag = true;
                        sel = 8;
                    }
                    else {
                        if ((myTile.ticks < myTile.goalTicks) || (myTile.goalTicks == 0)) {
                            if (playersOnThisChain(myTile.myChain, myTile.myChainLength) > 0) {
                                getNewFlag = true;
                                sel = 9;
                            }
                            else {
                                if ((myTile.goalTicks == 0) && (myTile.numMyConnections >= FORTIFY)) {
                                    persistentStore.maxFight = maxFight;
                                }
                                sel = 2;
                            }
                        }
                        else {
                            getNewFlag = true;
                            sel = 3;
                        }
                    }
                }
            }
            else {
                // VISITORS
                if (myTile.tickTeam !== player.id) {
                    getNewFlag = true;
                    sel = 4;
                }
                else {
                    // TBD tile not taken, so check remaining boost.  if > visitor, continue else move
                    if (myTile.numVisitors > 1) {
                        getNewFlag = true;
                        sel = 5;
                    }
                    else {
                        if (player.boostUsed > visitor1.boostUsed) {
                            getNewFlag = true;
                            sel = 6;
                        }
                    }
                }
            }
        }

        displayDebugMessage(2, 'getNewTile:: getNewFlag:' + (getNewFlag ? 'TRUE:' : 'FALSE:') + sel +
            ' maxFight:' + persistentStore.maxFight +
            ' numVisitors:' + myTile.numVisitors +
            ' numMyConnections:' + myTile.numMyConnections +
            ' Strength:' + myTile.strength +
            ' ticks/Goal/tickTeam: ' + Math.floor(myTile.ticks) + ',' + myTile.goalTicks + ',' + myTile.tickTeam +
            ' player{' + player.id + ',' + player.boost + ',' + player.boostUsed + '}' +
            (myTile.numVisitors > 0 ? ' visitor1{' + visitor1.id + ',' + visitor1.boost + ',' + visitor1.boostUsed + '}' : 'NO VISITORS')
            );

        return getNewFlag;
    }
    function miniGame(player, players, grid, message, framesLeft) {
        var done = false;
        var myTile = grid[player.row][player.col];
        var stage = getStage(persistentStore.maxFrames, framesLeft);

        // Check to see if a new tile should be selected
        if (getNewTileMini(workGrid, player, players)) {

            if (!done) {
                // If a chain is defined, follow the chain.
                done = getNextChainedTile(player, myTile);
            }

            if (!done) {
                done = getBestChain(player, stage);
                persistentStore.maxFight = maxFight;
            }

            if (!done) {
                done = getRandomSeedTile(workGrid, moveTiles, player);
            }

            if (!done) {
                done = getRandomSeed(workGrid, persistentStore.coreTiles, player);
            }

            if (!done) {
                // if there are currently no Chains selected, check Neighbor Tiles
                done = checkForNeighborOffsetTileByTypeIfNoChainTiles(grid, persistentStore, player, myTile);
            }
            if (done) persistentStore.maxFight = maxFight;
        }
        else {
            persistentStore.maxFight--;
            done = true;
        }

        return done;
    }
    function getNewTileShort(grid, player, players) {
        var getNewFlag = false;
        var myTile = grid[player.row][player.col];
        var visitor1;
        var FORTIFY = 4;
        var sel = 0;

        if (myTile.numVisitors > 0) {
            visitor1 = getPlayer(players, myTile.visitorsIds[0]);
        }

        if (persistentStore.maxFight < 0) {
            getNewFlag = true;
            sel = 1;
        }
        else {
            if (myTile.numVisitors == 0) {
                // NO VISITORS
                if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.numMyConnections < FORTIFY)) {
                    getNewFlag = true;
                    sel = 7;
                }
                else {
                    if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.strength == 1)) {
                        getNewFlag = true;
                        sel = 8;
                    }
                    else {
                        if ((myTile.ticks < myTile.goalTicks) || (myTile.goalTicks == 0)) {
                            if (playersOnThisChain(myTile.myChain, myTile.myChainLength) > 0) {
                                getNewFlag = true;
                                sel = 9;
                            }
                            else {
                                if ((myTile.goalTicks == 0) && (myTile.numMyConnections >= FORTIFY)) {
                                    persistentStore.maxFight = maxFight;
                                }
                                sel = 2;
                            }
                        }
                        else {
                            getNewFlag = true;
                            sel = 3;
                        }
                    }
                }
            }
            else {
                // VISITORS
                if (myTile.tickTeam !== player.id) {
                    getNewFlag = true;
                    sel = 4;
                }
                else {
                    // TBD tile not taken, so check remaining boost.  if > visitor, continue else move
                    if (myTile.numVisitors > 1) {
                        getNewFlag = true;
                        sel = 5;
                    }
                    else {
                        if (player.boostUsed > visitor1.boostUsed) {
                            getNewFlag = true;
                            sel = 6;
                        }
                    }
                }
            }
        }

        displayDebugMessage(2, 'getNewTile:: getNewFlag:' + (getNewFlag ? 'TRUE:' : 'FALSE:') + sel +
            ' maxFight:' + persistentStore.maxFight +
            ' numVisitors:' + myTile.numVisitors +
            ' numMyConnections:' + myTile.numMyConnections +
            ' Strength:' + myTile.strength +
            ' ticks/Goal/tickTeam: ' + Math.floor(myTile.ticks) + ',' + myTile.goalTicks + ',' + myTile.tickTeam +
            ' player{' + player.id + ',' + player.boost + ',' + player.boostUsed + '}' +
            (myTile.numVisitors > 0 ? ' visitor1{' + visitor1.id + ',' + visitor1.boost + ',' + visitor1.boostUsed + '}' : 'NO VISITORS')
            );

        return getNewFlag;
    }
    function shortGame(player, players, grid, message, framesLeft) {
        var done = false;
        var myTile = grid[player.row][player.col];
        var stage = getStage(persistentStore.maxFrames, framesLeft);

        // Check to see if a new tile should be selected
        if (getNewTileShort(workGrid, player, players)) {

            if (!done) {
                // If a chain is defined, follow the chain.
                done = getNextChainedTile(player, myTile);
            }

            if (!done) {
                done = getBestChain(player, stage);
                persistentStore.maxFight = maxFight;
            }

            if (!done) {
                done = getRandomSeedTile(workGrid, moveTiles, player);
            }

            if (!done) {
                done = getRandomSeed(workGrid, persistentStore.coreTiles, player);
            }

            if (!done) {
                // if there are currently no Chains selected, check Neighbor Tiles
                done = checkForNeighborOffsetTileByTypeIfNoChainTiles(grid, persistentStore, player, myTile);
            }
            if (done) persistentStore.maxFight = maxFight;
        }
        else {
            persistentStore.maxFight--;
            done = true;
        }

        return done;
    }
    function getNewTileMedium(grid, player, players) {
        var getNewFlag = false;
        var myTile = grid[player.row][player.col];
        var visitor1;
        var FORTIFY = 4;
        var sel = 0;

        if (myTile.numVisitors > 0) {
            visitor1 = getPlayer(players, myTile.visitorsIds[0]);
        }

        if (persistentStore.maxFight < 0) {
            getNewFlag = true;
            sel = 1;
        }
        else {
            if (myTile.numVisitors == 0) {
                // NO VISITORS
                if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.numMyConnections < FORTIFY)) {
                    getNewFlag = true;
                    sel = 7;
                }
                else {
                    if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.strength == 1)) {
                        getNewFlag = true;
                        sel = 8;
                    }
                    else {
                        if ((myTile.ticks < myTile.goalTicks) || (myTile.goalTicks == 0)) {
                            if (playersOnThisChain(myTile.myChain, myTile.myChainLength) > 0) {
                                getNewFlag = true;
                                sel = 9;
                            }
                            else {
                                if ((myTile.goalTicks == 0) && (myTile.numMyConnections >= FORTIFY)) {
                                    persistentStore.maxFight = maxFight;
                                }
                                sel = 2;
                            }
                        }
                        else {
                            getNewFlag = true;
                            sel = 3;
                        }
                    }
                }
            }
            else {
                // VISITORS
                if (myTile.tickTeam !== player.id) {
                    getNewFlag = true;
                    sel = 4;
                }
                else {
                    // TBD tile not taken, so check remaining boost.  if > visitor, continue else move
                    if (myTile.numVisitors > 1) {
                        getNewFlag = true;
                        sel = 5;
                    }
                    else {
                        if (player.boostUsed > visitor1.boostUsed) {
                            getNewFlag = true;
                            sel = 6;
                        }
                    }
                }
            }
        }

        displayDebugMessage(2, 'getNewTile:: getNewFlag:' + (getNewFlag ? 'TRUE:' : 'FALSE:') + sel +
            ' maxFight:' + persistentStore.maxFight +
            ' numVisitors:' + myTile.numVisitors +
            ' numMyConnections:' + myTile.numMyConnections +
            ' Strength:' + myTile.strength +
            ' ticks/Goal/tickTeam: ' + Math.floor(myTile.ticks) + ',' + myTile.goalTicks + ',' + myTile.tickTeam +
            ' player{' + player.id + ',' + player.boost + ',' + player.boostUsed + '}' +
            (myTile.numVisitors > 0 ? ' visitor1{' + visitor1.id + ',' + visitor1.boost + ',' + visitor1.boostUsed + '}' : 'NO VISITORS')
            );

        return getNewFlag;
    }
    function mediumGame(player, players, grid, message, framesLeft) {
        var done = false;
        var myTile = grid[player.row][player.col];
        var stage = getStage(persistentStore.maxFrames, framesLeft);

        // Check to see if a new tile should be selected
        if (getNewTileMedium(workGrid, player, players)) {

            if (!done) {
                // If a chain is defined, follow the chain.
                done = getNextChainedTile(player, myTile);
            }

            if (!done) {
                done = getBestChain(player, stage);
                persistentStore.maxFight = maxFight;
            }

            if (!done) {
                done = getRandomSeedTile(workGrid, moveTiles, player);
            }

            if (!done) {
                done = getRandomSeed(workGrid, persistentStore.coreTiles, player);
            }

            if (!done) {
                // if there are currently no Chains selected, check Neighbor Tiles
                done = checkForNeighborOffsetTileByTypeIfNoChainTiles(grid, persistentStore, player, myTile);
            }
            if (done) persistentStore.maxFight = maxFight;
        }
        else {
            persistentStore.maxFight--;
            done = true;
        }

        return done;
    }
    function getNewTileLong(grid, player, players) {
        var getNewFlag = false;
        var myTile = grid[player.row][player.col];
        var visitor1;
        var FORTIFY = 4;
        var sel = 0;

        if (myTile.numVisitors > 0) {
            visitor1 = getPlayer(players, myTile.visitorsIds[0]);
        }

        if (persistentStore.maxFight < 0) {
            getNewFlag = true;
            sel = 1;
        }
        else {
            if (myTile.numVisitors == 0) {
                // NO VISITORS
                if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.numMyConnections < FORTIFY)) {
                    getNewFlag = true;
                    sel = 7;
                }
                else {
                    if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.strength == 1)) {
                        getNewFlag = true;
                        sel = 8;
                    }
                    else {
                        if ((myTile.ticks < myTile.goalTicks) || (myTile.goalTicks == 0)) {
                            if (playersOnThisChain(myTile.myChain, myTile.myChainLength) > 0) {
                                getNewFlag = true;
                                sel = 9;
                            }
                            else {
                                if ((myTile.goalTicks == 0) && (myTile.numMyConnections >= FORTIFY)) {
                                    persistentStore.maxFight = maxFight;
                                }
                                sel = 2;
                            }
                        }
                        else {
                            getNewFlag = true;
                            sel = 3;
                        }
                    }
                }
            }
            else {
                // VISITORS
                if (myTile.tickTeam !== player.id) {
                    getNewFlag = true;
                    sel = 4;
                }
                else {
                    // TBD tile not taken, so check remaining boost.  if > visitor, continue else move
                    if (myTile.numVisitors > 1) {
                        getNewFlag = true;
                        sel = 5;
                    }
                    else {
                        if (player.boostUsed > visitor1.boostUsed) {
                            getNewFlag = true;
                            sel = 6;
                        }
                    }
                }
            }
        }

        displayDebugMessage(2, 'getNewTile:: getNewFlag:' + (getNewFlag ? 'TRUE:' : 'FALSE:') + sel +
            ' maxFight:' + persistentStore.maxFight +
            ' numVisitors:' + myTile.numVisitors +
            ' numMyConnections:' + myTile.numMyConnections +
            ' Strength:' + myTile.strength +
            ' ticks/Goal/tickTeam: ' + Math.floor(myTile.ticks) + ',' + myTile.goalTicks + ',' + myTile.tickTeam +
            ' player{' + player.id + ',' + player.boost + ',' + player.boostUsed + '}' +
            (myTile.numVisitors > 0 ? ' visitor1{' + visitor1.id + ',' + visitor1.boost + ',' + visitor1.boostUsed + '}' : 'NO VISITORS')
            );

        return getNewFlag;
    }
    function longGame(player, players, grid, message, framesLeft) {
        var done = false;
        var myTile = grid[player.row][player.col];
        var stage = getStage(persistentStore.maxFrames, framesLeft);

        // Check to see if a new tile should be selected
        if (getNewTileLong(workGrid, player, players)) {

            if (!done) {
                // If a chain is defined, follow the chain.
                done = getNextChainedTile(player, myTile);
            }

            if (!done) {
                done = getBestChain(player, stage);
                persistentStore.maxFight = maxFight;
            }

            if (!done) {
                done = getRandomSeedTile(workGrid, moveTiles, player);
            }

            if (!done) {
                done = getRandomSeed(workGrid, persistentStore.coreTiles, player);
            }

            if (!done) {
                // if there are currently no Chains selected, check Neighbor Tiles
                done = checkForNeighborOffsetTileByTypeIfNoChainTiles(grid, persistentStore, player, myTile);
            }
            if (done) persistentStore.maxFight = maxFight;
        }
        else {
            persistentStore.maxFight--;
            done = true;
        }

        return done;
    }
    function getNewTileLonggggg(grid, player, players) {
        var getNewFlag = false;
        var myTile = grid[player.row][player.col];
        var visitor1;
        var FORTIFY = 4;
        var sel = 0;

        if (myTile.numVisitors > 0) {
            visitor1 = getPlayer(players, myTile.visitorsIds[0]);
        }

        if (persistentStore.maxFight < 0) {
            getNewFlag = true;
            sel = 1;
        }
        else {
            if (myTile.numVisitors == 0) {
                // NO VISITORS
                if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.numMyConnections < FORTIFY)) {
                    getNewFlag = true;
                    sel = 7;
                }
                else {
                    if ((myTile.team == player.id) && ((myTile.goalTicks == 0) && (myTile.goalTicks == 0) && (myTile.tickTeam == 0)) && (myTile.strength == 1)) {
                        getNewFlag = true;
                        sel = 8;
                    }
                    else {
                        if ((myTile.ticks < myTile.goalTicks) || (myTile.goalTicks == 0)) {
                            if (playersOnThisChain(myTile.myChain, myTile.myChainLength) > 0) {
                                getNewFlag = true;
                                sel = 9;
                            }
                            else {
                                if ((myTile.goalTicks == 0) && (myTile.numMyConnections >= FORTIFY)) {
                                    persistentStore.maxFight = maxFight;
                                }
                                sel = 2;
                            }
                        }
                        else {
                            getNewFlag = true;
                            sel = 3;
                        }
                    }
                }
            }
            else {
                // VISITORS
                if (myTile.tickTeam !== player.id) {
                    getNewFlag = true;
                    sel = 4;
                }
                else {
                    // TBD tile not taken, so check remaining boost.  if > visitor, continue else move
                    if (myTile.numVisitors > 1) {
                        getNewFlag = true;
                        sel = 5;
                    }
                    else {
                        if (player.boostUsed > visitor1.boostUsed) {
                            getNewFlag = true;
                            sel = 6;
                        }
                    }
                }
            }
        }

        displayDebugMessage(2, 'getNewTile:: getNewFlag:' + (getNewFlag ? 'TRUE:' : 'FALSE:') + sel +
            ' maxFight:' + persistentStore.maxFight +
            ' numVisitors:' + myTile.numVisitors +
            ' numMyConnections:' + myTile.numMyConnections +
            ' Strength:' + myTile.strength +
            ' ticks/Goal/tickTeam: ' + Math.floor(myTile.ticks) + ',' + myTile.goalTicks + ',' + myTile.tickTeam +
            ' player{' + player.id + ',' + player.boost + ',' + player.boostUsed + '}' +
            (myTile.numVisitors > 0 ? ' visitor1{' + visitor1.id + ',' + visitor1.boost + ',' + visitor1.boostUsed + '}' : 'NO VISITORS')
            );

        return getNewFlag;
    }
    function longggggGame(player, players, grid, message, framesLeft) {
        var done = false;
        var myTile = grid[player.row][player.col];
        var stage = getStage(persistentStore.maxFrames, framesLeft);

        // Check to see if a new tile should be selected
        if (getNewTileLonggggg(workGrid, player, players)) {

            if (!done) {
                // If a chain is defined, follow the chain.
                done = getNextChainedTile(player, myTile);
            }

            if (!done) {
                done = getBestChain(player, stage);
                persistentStore.maxFight = maxFight;
            }

            if (!done) {
                done = getRandomSeedTile(workGrid, moveTiles, player);
            }

            if (!done) {
                done = getRandomSeed(workGrid, persistentStore.coreTiles, player);
            }

            if (!done) {
                // if there are currently no Chains selected, check Neighbor Tiles
                done = checkForNeighborOffsetTileByTypeIfNoChainTiles(grid, persistentStore, player, myTile);
            }
            if (done) persistentStore.maxFight = maxFight;
        }
        else {
            persistentStore.maxFight--;
            done = true;
        }

        return done;
    }
    // GAMES

    return {
        name: botName,
        doBehavior: function (player, players, grid, message, framesLeft) {
            var done = false;

            //debugger;

            done = startGame(player, players, grid, message, framesLeft);
            if (done) {
                return {
                    outX: player.col,
                    outY: player.row,
                    outB: player.boost
                };
            }

            // grab my tile
            var myTile = workGrid[player.row][player.col];
            var noVisitorKeys = myTile.numVisitors;
            var stage = getStage(persistentStore.maxFrames, framesLeft);

            // CYCLE Start Values before new selection
            displayWorkData(2, 'START SELECTION         for Player: ', player, workGrid, persistentStore, framesLeft);

            // if the stop flag is set return the unchanged player state
            // (bot is effectively frozen)
            if (pauseOrResume(persistentStore, message)) {
                log('Bot ' + botName + ' is PAUSED.');
                displayDebugMessage(2, 'RETURN paused PLAYER[' + player.row + ',' + player.row + ',B' + player.boost + ']');
                return {
                    outX: player.col,
                    outY: player.row,
                    outB: player.boost
                };
            }
            
            switch (persistentStore.gameType) {
                case 1: // mini cycle(10)
                    maxFight = 10;
                    done = miniGame(player, players, grid, message, framesLeft);
                    break;
                case 2: // Short cycle(20)
                    maxFight = 14;
                    done = shortGame(player, players, grid, message, framesLeft);
                    break;
                case 3: // medium cycle(30)
                    maxFight = 18;
                    done = mediumGame(player, players, grid, message, framesLeft);
                    break;
                case 4: // long cycle(60)
                    done = longGame(player, players, grid, message, framesLeft);
                    break;
                default: // longgggggg cycle(>60)
                    done = longggggGame(player, players, grid, message, framesLeft);
                    break;
            }

            // END GAME
            // If we get here and nothing is selected, go pure random
            if (!done) {
                done = getRandomTileForPlayer('BOTTOM', player);
            }

            setPlayerBoost(workGrid, player, players);

            displayWorkData(2, 'RETURN PLAYER SELECTION for Player: ', player, workGrid, persistentStore, framesLeft);

            persistentStore.framesLeft = framesLeft;

            return {
                outX: player.col,
                outY: player.row,
                outB: player.boost
            };
        }
    };
}