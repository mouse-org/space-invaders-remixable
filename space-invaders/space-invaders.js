var gameSpeed = 0//10000;
var gamePaused = false;

var shootThisFrame = false;
var betweenLevels = false;

var cursorX;
var cursorY;

var gameOver = false;
var reset = false;
var levelOver = false;

var canvas;
var screen;

const defaultParams = {
  shootingDelay: 100,
  playerSpeed: 60,
  playerBulletSize: 3,
  invaderSize: 15,
  invaderSpeed: 10,
  invaderPatrolDistance: 30,
  invaderBulletSize: 3,
  invaderShootingFrequency: 10,
  invaderBulletDirectionRandomness: 5,
  invaderBulletSpeed: 2,
  mouseControl: false,
  startingLives: 3,
  playerShape: 'playerSquare',
  invaderShape: 'invaderSquare',
  invaderColor: '#EFEFAF',
  playerColor: '#DFDFDF',
  backgroundColor: '#000000',
  
  gameURL: 'https://space-invaders-remixable.glitch.me/',
};

var toggle = document.getElementById('toggle');
var parameters = document.getElementById('parameters');
var toggleButton = document.getElementById('toggle-button');
toggleButton.onclick = function() {
  toggle.style.display = "none";
  parameters.style.display = "block";
}


function getParamsFromHash() {
  var hashParams = {};
  
  if(window.location.hash) {
    var hash = window.location.hash;
    var paramString = hash.substring(1, hash.length);
    var paramStringArray = paramString.split('&');

    for (var i in paramStringArray) {
      var paramArray = paramStringArray[i].split('=');
      // What about non ints
      hashParams[paramArray[0]] = paramArray[1];
    }
  }
  
  console.log("Params from Hash:\n " + JSON.stringify(hashParams));
  
  return hashParams;
}

function updateInputsAndSetListeners(paramId, paramValue, callback) {
  // fieldset elements for radio buttons don't have value
  const fieldsetParams = ['playerShape', 'invaderShape'];
  
  // Set values of all input elements to the default from defaultParams
  var paramInput = document.getElementById(paramId);
  if (fieldsetParams.indexOf(paramId) > -1) {
    console.log("In Array: " + paramId);
  } else {
    if (paramInput) {
      setInputValue(paramInput, paramValue);
    }
  }

  // Set the <span> in the label of each element to show the value
  var valueElement = document.getElementById(paramId + '-value');
  // Text, shape inputs don't have a corresponding value element
  if (valueElement) {
    setLabelValue(valueElement, paramValue);
  }

  // Set listener for updated params
  if (paramInput) {
    paramInput.onchange = function(e) {
      e.preventDefault();
      var newValue;
      if (fieldsetParams.indexOf(paramId) > -1) {
          var selectedOption = document.querySelector('input[name = "' + paramId + '"]:checked');
          newValue = selectedOption.value;
      } else {
        newValue = this.value;
      }

      if (valueElement) {
        setLabelValue(valueElement, newValue);
      }
      callback(paramId, newValue)

      document.getElementById("hidden-input").focus();
    }
  }
}


function setInputValue(element, value) {
  element.value = value;
}

function setLabelValue(valueElement, value) {
  valueElement.innerHTML = value;
}


function setGameUrlAndHashFrom(params) {
  var gameURL = params.gameURL.split(".me/")[0] + ".me/";
  
  var hash = "";
  for (var i in params) {
    if (
      i != 'gameURL' &&
      i != 'mouseControl'
    ) {
       hash += '' + i + '=' + params[i] + '&';
    }
  }

  hash = hash.substr(0, hash.length - 1);
  gameURL += ('#' + hash);
  
  window.location.hash = hash;
  document.getElementById('gameURL').value = gameURL;
  params.gameURL = gameURL;
  return params;
}


// Read params from URL Hash:
var hashParams = getParamsFromHash()

// Store mouse control outside of Game so it doesn't copy to url:
var mouseControlCheckbox = document.getElementById('mouseControl');




;(function() {

  // Main game object
  // ----------------

  // **new Game()** Creates the game object with the game state and logic.
  var Game = function() {
    
    this.params = Object.assign({}, defaultParams, hashParams);
    console.log("THIS.PARAMS");
    console.log(this.params);
    
    // Set listeners for each param in defaultParams
    for (var i in this.params) {
      updateInputsAndSetListeners(i, this.params[i], function(paramId, newValue) {
        this.params[paramId] = newValue;
        this.params = setGameUrlAndHashFrom(this.params);
      }.bind(this));
    }
    
    this.params = setGameUrlAndHashFrom(this.params);
                                  
    
    gamePaused = false;
    //this.params = params;
    
    this.score = 0;
    this.lives = this.params.startingLives;

    // In index.html, there is a canvas tag that the game will be drawn in.
    // Grab that canvas out of the DOM.
    canvas = document.getElementById("space-invaders");

    // Get the drawing context.  This contains functions that let you draw to the canvas.
    screen = canvas.getContext('2d');
    
    
    // Mouse/Touchscreen controls:
    canvas.addEventListener('mousemove', function(e) {
      e.preventDefault();
      var mousePos = getMousePos(canvas, e);
      printXY(mousePos);
    }, false);

    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      e = e.touches[0];
      var mousePos = getMousePos(canvas, e);
      printXY(mousePos);
    }, false);

    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      var mousePos = getMousePos(canvas, e);
      printXY(mousePos);
      shootThisFrame = true;
    }, false);

    canvas.addEventListener('click', function(e) {
      e.preventDefault();
      shootThisFrame = true;
    });
    
    function getMousePos(canvas, evt) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      };
    }

    function printXY(coords) {
      cursorX = coords.x;
      cursorY = coords.y;
    }

    // Note down the dimensions of the canvas.  These are used to
    // place game bodies.
    var gameSize = { x: canvas.width, y: canvas.height };
    this.gameSize = gameSize;

    // Create the bodies array to hold the player, invaders and bullets.
    this.bodies = [];

    // Add the invaders to the bodies array.
    this.bodies = this.bodies.concat(createInvaders(this));

    
    
    // Add the player to the bodies array.
    this.bodies = this.bodies.concat(new Player(this, gameSize));

    // In index.html, there is an audio tag that loads the shooting sound.
    // Get the shoot sound from the DOM and store it on the game object.
    this.shootSound = document.getElementById('shoot-sound');
    
    this.scoreCounter = document.getElementById('score');
    this.livesCounter = document.getElementById('lives');
    
    this.shootingAllowed = true;


    var self = this;

    // Main game tick function.  Loops forever, running 60ish times a second.
    var tick = function() {
      
      //console.log(JSON.stringify(self.params));
            
      // Check if gameOver
      if (self.lives < 1) {
        gameOver = true;
      }
      
      
      if (!gamePaused) {
        self.scoreCounter.innerHTML = self.score;
        self.livesCounter.innerHTML = self.lives;

        // Check for changed parameters.
        self.updateParams();
        // Update game state.
        self.update();

        // Draw game bodies.
        self.draw(screen, gameSize);

        // Queue up the next call to tick with the browser.
        //requestAnimationFrame(tick);
        if (!gameOver) {
          setTimeout(function() {
            requestAnimationFrame(tick);
          }, gameSpeed);
        } else {
          gameOver = false;
          // Save previous game params
          hashParams = self.params;
          if (!reset) {
            screen.font = "30px Courier";
            screen.fillText("Game Over",64,140);
            setTimeout(function() {   
              currentGame = new Game();
            }, 3000);
          } else {
            currentGame = new Game(); 
          }
        }
      } else {
        setTimeout(function() {
          tick();
        }, gameSpeed);
      }
      
    }//.bind(this);

    // Run the first game tick.  All future calls will be scheduled by
    // the tick() function itself.
    tick();
    
    var defaultsButton = document.getElementById('reset-defaults');
    defaultsButton.onclick = () => {
      this.params.resetParams = true;
      document.getElementById("hidden-input").focus();
    }
    var randomizeButton = document.getElementById('randomize');
    randomizeButton.onclick = function() {
      this.params.randomParams = true;
      document.getElementById("hidden-input").focus();
    }
    
    
  };

  Game.prototype = {
    
    
    updateParams: function() {
      
      // Check for reset or random
      if (this.params.resetParams) {
        for (var i in this.params) {
          
          /*
          Not Working:
          Colors
          
          */
          
          if (defaultParams[i]) {
            
            var valueElement = document.getElementById(i + '-value');
            var inputElement = document.getElementById(i);
            
            if (i != 'mouseControl' && i != 'gameURL') {
              
              if (valueElement) {
                setLabelValue(valueElement, defaultParams[i]);
              }
              
              if (inputElement) {
                if (i === 'startingLives') {
                  inputElement.value = defaultParams[i];
                } else if (i === 'playerShape' || i === 'invaderShape') {
                  var nodes = inputElement.childNodes;
                  for (var j in nodes) {
                    nodes[j].checked = false;
                    if (nodes[j].id === defaultParams[i]) {
                       nodes[j].checked = true;
                    }
                  }
                } else {
                  setInputValue(inputElement, defaultParams[i]);
                }
              }
              this.params[i] = defaultParams[i]; 
            }
          }
        }
        setGameUrlAndHashFrom(this.params);
        this.params.resetParams = false;
      }
      if (this.params.randomParams) {
        alert("RANDOM");
        this.params.randomParams = false;
      }
      
      
      // Update Invader Size
      for (var i in this.bodies) {
        if(this.bodies[i] instanceof Invader) {
          var invader = this.bodies[i];
          invader.size.x = this.params.invaderSize;
          invader.size.y = this.params.invaderSize;
        }
      }
      
      
      // Update Mouse Control
      this.params.mouseControl = mouseControlCheckbox.checked
      ///this.params = setGameURL(this.params);
      //console.log(JSON.stringify(params));
    },
    

    // **update()** runs the main game logic.
    update: function() {
      var self = this;
      
      

      // `notCollidingWithAnything` returns true if passed body
      // is not colliding with anything.
      var notCollidingWithAnything = function(b1) {
        var notCollisionStatus = self.bodies.filter(function(b2) { return colliding(b1, b2); }).length === 0;
   
        if (!notCollisionStatus) {
          var bodyGame = b1.game;
          if (b1 instanceof Invader) {
            bodyGame.score++;
          } else if (b1 instanceof Player) {
            bodyGame.lives--;
            setTimeout(function() {
              bodyGame.bodies = bodyGame.bodies.concat(new Player(bodyGame, bodyGame.gameSize));
            }, 1000);
          }
        }
        
        return notCollisionStatus;
      };
  

      // Throw away bodies that are colliding with something. They
      // will never be updated or draw again.
      this.bodies = this.bodies.filter(notCollidingWithAnything);

      // Call update on every body.
      
      var clearedInvaders = true;
      
      for (var i = 0; i < this.bodies.length; i++) {
        var nextBody = this.bodies[i];
        if (nextBody instanceof Invader) {
          clearedInvaders = false;
        }
        nextBody.update();
      }
      
      if (clearedInvaders && !betweenLevels) {
        betweenLevels = true;
        this.score += 10;
        setTimeout(function() {
          this.bodies = this.bodies.concat(createInvaders(this));
          betweenLevels = false;
        }.bind(this), 1000);
      }
      
      
    },

    // **draw()** draws the game.
    draw: function(screen, gameSize) {
      // Clear away the drawing from the previous tick.
      screen.clearRect(0, 0, gameSize.x, gameSize.y);
      screen.fillStyle = this.params.backgroundColor;
      screen.fillRect(0, 0, gameSize.x, gameSize.y);

      // Draw each body as a rectangle.
      for (var i = 0; i < this.bodies.length; i++) {
        drawBody(screen, this.bodies[i]);
      }
    },

    // **invadersBelow()** returns true if `invader` is directly
    // above at least one other invader.
    invadersBelow: function(invader) {
      // If filtered array is not empty, there are invaders below.
      return this.bodies.filter(function(b) {
        // Keep `b` if it is an invader, if it is in the same column
        // as `invader`, and if it is somewhere below `invader`.
        return b instanceof Invader &&
          Math.abs(invader.center.x - b.center.x) < b.size.x  &&
          b.center.y > invader.center.y;
      }).length > 0;
    },

    // **addBody()** adds a body to the bodies array.
    addBody: function(body) {
      this.bodies.push(body);
    }
  };

  // Invaders
  // --------

  // **new Invader()** creates an invader.
  var Invader = function(game, center) {
    this.game = game;
    this.center = center;
    
    //console.log(JSON.stringify(game));
    this.size = { x: game.params.invaderSize, y: game.params.invaderSize };

    // Invaders patrol from left to right and back again.
    // `this.patrolX` records the current (relative) position of the
    // invader in their patrol.  It starts at 0, increases to 40, then
    // decreases to 0, and so forth.
    this.patrolX = 0;
    //this.patrolMax = this.game.params.invaderPatrolDistance;

    // The x speed of the invader.  A positive value moves the invader
    // right. A negative value moves it left.
    //this.speedX = this.game.params.invaderSpeed / 30;
  };

  Invader.prototype = {

    // **update()** updates the state of the invader for a single tick.
    update: function() {
      var setSpeed = this.game.params.invaderSpeed / 30;
      this.speedX = this.speedX > 0 ? setSpeed : -setSpeed;
      this.patrolMax = this.game.params.invaderPatrolDistance;
      // If the invader is outside the bounds of their patrol...
      if (this.patrolX < (-this.patrolMax + 30) || this.patrolX > this.patrolMax) {

        // ... reverse direction of movement.
        this.speedX = -this.speedX;
      }

      // If coin flip comes up and no friends below in this
      // invader's column...
      
      var chanceToShoot = Math.random() + (this.game.params.invaderShootingFrequency / 10000);
      if (chanceToShoot > 1 &&
          !this.game.invadersBelow(this)) {
      
        
        // ... create a bullet just below the invader that will move
        // downward...
        
        var bulletSize = {
          x: this.game.params.invaderBulletSize,
          y: this.game.params.invaderBulletSize
        }
        
        
        var bulletDirectionRandomness = this.game.params.invaderBulletDirectionRandomness / 10;
        var bulletDirection = (bulletDirectionRandomness * (2 * Math.random())) - bulletDirectionRandomness;
        var bulletSpeed = this.game.params.invaderBulletSpeed / 4;
        
        var bullet = new Bullet({ x: this.center.x, y: this.center.y + (this.size.y / 2) + (bulletSize.y / 2) },
                                { x: bulletDirection * bulletSpeed, y:  2 * bulletSpeed}, bulletSize);

        // ... and add the bullet to the game.
        this.game.addBody(bullet);
      }

      // Move according to current x speed.
      this.center.x += this.speedX;

      // Update variable that keeps track of current position in patrol.
      this.patrolX += this.speedX;
    }
  };

  // **createInvaders()** returns an array of twenty-four invaders.
  var createInvaders = function(game) {
    var invaders = [];
    
    /* Parameter */
    
    var numberOfInvaders = 24;
    //var numberOfInvaders = 0;
    var invaderGroupWidth = 8;
    var invaderGroupHeight = 3;
    
    /*
    ### Figure out number of invaders
    if (params) {
      if (params.height && params.width) {
        invaderGroupWidth = params.width;
        invaderGroupHeight = params.height;
        numberOfInvaders = invaderGroupWidth * invaderGroupHeight;
      }
    }
    */
    
    
    for (var i = 0; i < numberOfInvaders; i++) {

      // Place invaders in eight columns.
      var x = 30 + (i % invaderGroupWidth) * 30;

      // Place invaders in three rows.
      var y = 30 + (i % invaderGroupHeight) * 30;

      // Create invader.
      invaders.push(new Invader(game, { x: x, y: y}));
    }
    
    return invaders;
  };

  // Player
  // ------

  // **new Player()** creates a player.
  var Player = function(game, gameSize) {
    this.game = game;
    this.size = { x: 15, y: 15 };
    this.center = { x: gameSize.x / 2, y: gameSize.y - this.size.y * 2 };

    // Create a keyboard object to track button presses.
    this.keyboarder = new Keyboarder();
  };

  Player.prototype = {

    // **update()** updates the state of the player for a single tick.
    update: function() {
      
      // If left cursor key is down...
      if (this.keyboarder.isDown(this.keyboarder.KEYS.LEFT)) {

        // ... move left.
        this.center.x -= this.game.params.playerSpeed / 30;
      } else if (this.keyboarder.isDown(this.keyboarder.KEYS.RIGHT)) {
        this.center.x += this.game.params.playerSpeed / 30;
      }
      if (this.game.params.mouseControl) {
        if (this.center.x > cursorX) {
          this.center.x -= this.game.params.playerSpeed / 30;
        } else if (this.center.x < cursorX) {
          this.center.x += this.game.params.playerSpeed / 30;
        }
      }
      
      
      // Don't allow player to go off the screen      
      if (this.center.x > 290) {
        this.center.x = 290;
      }
      if (this.center.x < 10) {
        this.center.x = 10;
      }

      // If S key is down...
      if (this.keyboarder.isDown(this.keyboarder.KEYS.S) || shootThisFrame) {
        // ... create a bullet just above the player that will move upwards...
        var bulletSize = {
          x: this.game.params.playerBulletSize,
          y: this.game.params.playerBulletSize
        }
        var bullet = new Bullet({ x: this.center.x, y: this.center.y - this.size.y - 10 },
                                { x: 0, y: -7 }, bulletSize);

        // ... add the bullet to the game...
        
        if (this.game.shootingAllowed) {
          this.game.addBody(bullet);

          // ... rewind the shoot sound...
          this.game.shootSound.load();

          // ... and play the shoot sound.
          this.game.shootSound.play();
          
          this.game.shootingAllowed = false;
          setTimeout(() => this.game.shootingAllowed = true, this.game.params.shootingDelay)
        }
        shootThisFrame = false;
      }
    }
  };

  // Bullet
  // ------

  // **new Bullet()** creates a new bullet.
  var Bullet = function(center, velocity, size) {
    this.center = center;
    this.size = { x: size.x, y: size.y };
    this.velocity = velocity;
  };

  Bullet.prototype = {

    // **update()** updates the state of the bullet for a single tick.
    update: function() {

      // Add velocity to center to move bullet.
      this.center.x += this.velocity.x;
      this.center.y += this.velocity.y;
    }
  };

  // Keyboard input tracking
  // -----------------------

  // **new Keyboarder()** creates a new keyboard input tracking object.
  var Keyboarder = function() {

    // Records up/down state of each key that has ever been pressed.
    var keyState = {};

    // When key goes down, record that it is down.
    window.addEventListener('keydown', function(e) {
      keyState[e.keyCode] = true;
    });

    // When key goes up, record that it is up.
    window.addEventListener('keyup', function(e) {
      keyState[e.keyCode] = false;
    });

    // Returns true if passed key is currently down.  `keyCode` is a
    // unique number that represents a particular key on the keyboard.
    this.isDown = function(keyCode) {
      return keyState[keyCode] === true;
    };

    // Handy constants that give keyCodes human-readable names.
    this.KEYS = { LEFT: 37, RIGHT: 39, S: 83 };
  };

  // Other functions
  // ---------------

  // **drawBody()** draws passed body as a rectangle to `screen`, the drawing context.
  var drawBody = function(screen, body) {
    
    var drawShapeBody;
    
    function selectBodyType(shape) {
      
      function drawRectBody(color, x, y, sizeX, sizeY) {
        screen.fillStyle = color;
        screen.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
      }

      function drawTriBody(color, x, y, sizeX, sizeY) {
        screen.fillStyle = color;
        screen.beginPath();
        screen.moveTo(x, y + sizeY / 2);
        screen.lineTo(x + sizeX / 2, y - sizeY / 2);
        screen.lineTo(x - sizeX / 2, y - sizeY / 2);
        screen.lineTo(x, y + sizeY / 2);
        screen.fill();
        //screen.strokeStyle = 'red';
        //screen.strokeRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
      }

      function drawInvTriBody(color, x, y, sizeX, sizeY) {
        drawTriBody(color, x, y, sizeX, -sizeY)
      }

      function drawCircBody(color, x, y, sizeX, sizeY) {
        screen.fillStyle = color;
        screen.beginPath();
        screen.arc(x, y, sizeX / 2, 0, Math.PI * 2, true);
        screen.fill();
      }
      
      
      switch(shape) {
        case 'invaderSquare':
        case 'playerSquare':
          drawShapeBody = drawRectBody;
          break;
        case 'invaderTriangle':
        case 'playerTriangle':
          drawShapeBody = drawInvTriBody;
          break;
        case 'invaderCircle':
        case 'playerCircle':
          drawShapeBody = drawCircBody;
          break;
        default:
          drawShapeBody = drawRectBody;
      }
      return drawShapeBody;
    }
    
    if (body instanceof Invader) {
      drawShapeBody = selectBodyType(body.game.params.invaderShape).bind(this, body.game.params.invaderColor);
    } else if (body instanceof Player) {
      drawShapeBody = selectBodyType(body.game.params.playerShape).bind(this, body.game.params.playerColor);
    } else {
      drawShapeBody = selectBodyType('square').bind(this, "#FFF");
    }
    
    drawShapeBody(body.center.x, body.center.y, body.size.x, body.size.y);  
    
  };
  


  // **colliding()** returns true if two passed bodies are colliding.
  // The approach is to test for five situations.  If any are true,
  // the bodies are definitely not colliding.  If none of them
  // are true, the bodies are colliding.
  // 1. b1 is the same body as b2.
  // 2. Right of `b1` is to the left of the left of `b2`.
  // 3. Bottom of `b1` is above the top of `b2`.
  // 4. Left of `b1` is to the right of the right of `b2`.
  // 5. Top of `b1` is below the bottom of `b2`.
  var colliding = function(b1, b2) {
    var collisionDetected = !(
      b1 === b2 ||
        b1.center.x + b1.size.x / 2 < b2.center.x - ((b2.size.x - 2) / 2) ||
        b1.center.y + b1.size.y / 2 < b2.center.y - ((b2.size.y - 2) / 2) ||
        b1.center.x - b1.size.x / 2 > b2.center.x + ((b2.size.x - 2) / 2) ||
        b1.center.y - b1.size.y / 2 > b2.center.y + ((b2.size.y - 2) / 2)
    )
    return collisionDetected;
  };

  // Start game
  // ----------

  
  // When the DOM is ready, create (and start) the game.
  window.addEventListener('load', function() {
    
    currentGame = new Game();
  });
  
  var resetButton = document.getElementById('reset-button');
  resetButton.addEventListener('click', function() {
    gameOver = true;
    reset = true;
  });
  
  var pauseButton = document.getElementById('pause-button');
  pauseButton.addEventListener('click', function() {
    if (gamePaused) {
      gamePaused = false;
      pauseButton.innerHTML = 'Pause';
    } else {
      gamePaused = true;
      pauseButton.innerHTML = 'Start';
    }
  });


})();

var currentGame;
