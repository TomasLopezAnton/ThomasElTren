import EndMenu from './endMenu.js'
import Train, * as train from './train.js'
import Rail, * as rail from './Rail.js'
import Collectible, * as collectible from './collectible.js'
import Water, * as water from './water.js'
import Inventory, * as inventory from './inventory.js'
import {directionEnum, matrixEnum, stateEnum} from './Enums.js'

const TILE_SIZE = 50;
const COLUMNS = 28;
const ROWS = 16;
const POOL_LENGTH = 12; //Siempre par
const INITIAL_TRAIN_SPEED = 5;
const SPEED_INCREASE = 2;
const WATER_SLOTS = 50;

export default class Game extends Phaser.Scene {
  constructor(level) {
    super({ key: 'main' });
    this.level = level;
    this.inventory;
    this.score = 0;
    this.scoreText;
    this.state = stateEnum.ONTRACK;
    this.currentSpeed = INITIAL_TRAIN_SPEED;
    this.railPool = [];
    this.trainArray = [];
    this.aestheticRails = [];
  }

  preload()
  {
    this.load.tilemapTiledJSON('tilemap1','tilemaps/tilemap1.json');
    this.load.tilemapTiledJSON('tilemap2','tilemaps/tilemap2.json');
    this.load.tilemapTiledJSON('tilemap3','tilemaps/tilemap3.json');
    this.load.image('patronesTilemap1','img/terrain1.png');
    this.load.image('patronesTilemap2','img/terrain2.png');
    this.load.image('patronesTilemap3','img/terrain3.png');
    this.load.image('railsprite', 'img/rail.png', {frameWidth: 32, frameHeight: 48})
    this.load.image('trainsprite', 'img/trainwagon.png', { frameWidth: 50, frameHeight: 50 })

    this.load.image('passengersprite', 'img/passenger.png', { frameWidth: 50, frameHeight: 50 })
    this.load.image('boxsprite', 'img/box.png', { frameWidth: 50, frameHeight: 50 })
    this.load.image('watersprite', 'img/water.png', { frameWidth: 50, frameHeight: 50 })

    this.load.image('curvedrailsprite', 'img/curvedrail.png', {frameWidth: 32, frameHeight: 32})

  }

  create()
  {

    this.map = this.make.tilemap({
      key: 'tilemap'+this.level,
      tileWidth: 64,
      tileHeight: 64
    });


    this.r = this.input.keyboard.addKey('R');
    this.esc = this.input.keyboard.addKey('ESC');

    this.map.addTilesetImage('terrain'+this.level,'patronesTilemap'+this.level);
    //crea capa con tileset "terrain"
    this.backgroundLayer = this.map.createStaticLayer('Background','terrain'+this.level);
    //se añade colision a las partes que tengan atributo collides == true
    this.backgroundLayer.setCollisionByProperty({collides: true});
    this.physics.world.setBounds(0, 0, 1400, 800);
    this.scoreText = this.add.text(1155, 15, 'Puntos: 0', { fontFamily: 'Verdana, "Times New Roman", Tahoma, serif' ,fontSize: '35px'});
    
    //para ver la caja de colisiones del layer
    // const debugGraphics = this.add.graphics().setAlpha(0.75);
    // this.backgroundLayer.renderDebug(debugGraphics, {
    // tileColor: null, // Color of non-colliding tiles
    // collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255), // Color of colliding tiles
    // faceColor: new Phaser.Display.Color(40, 39, 37, 255) // Color of colliding face edges
    // });

    //grupos de colisiones
    this.railsGroup = this.physics.add.group();
    this.trainsGroup = this.physics.add.group();
    this.passengersGroup = this.physics.add.group();
    this.boxsGroup = this.physics.add.group();
    this.waterGroup = this.physics.add.group();
    //crea las entidades (los pasajeros seran un array tambien)
    this.passenger = new Collectible(this, 11, 9, 'passengersprite');

    //Crea agua en el mapa
    for(let i=0;i<WATER_SLOTS;i++) this.createWater();

    this.trainArray[0] = new Train(this, 11 * TILE_SIZE + TILE_SIZE / 2, 15 * TILE_SIZE + TILE_SIZE / 2, 'trainsprite', INITIAL_TRAIN_SPEED, directionEnum.UP);
    this.trainArray[1] = new Train(this, 11 * TILE_SIZE + TILE_SIZE / 2, 16 * TILE_SIZE + TILE_SIZE / 2, 'trainsprite', INITIAL_TRAIN_SPEED, directionEnum.UP);
    //se añaden a los grupos de colisiones
    this.passengersGroup.add(this.passenger);
    this.trainsGroup.add(this.trainArray[0]);
    this.trainsGroup.add(this.trainArray[1]);

    //creacion de colisiones entre entidades, y callbacks
    this.physics.add.collider(this.trainsGroup, this.passengersGroup, (o1, o2) => {
      o2.destroy();
      this.createNewTrain();
      this.createPassenger();
      let rnd = Math.round(Math.random() * 10);
      if(rnd>=8) this.createBox();
      this.currentSpeed += SPEED_INCREASE;
      this.inventory.ModifyRailCounter(1, 'A')
      this.score+=10;
      this.scoreText.setText('Puntos: '+ this.score);
      this.changeTrainSpeed();
    });
    this.physics.add.collider(this.trainsGroup, this.boxsGroup, (o1, o2) => {
      o2.destroy();
      let rnd = Math.round(Math.random() * 10);
      if(rnd>=5){
        this.inventory.ModifyRailCounter(1,'B');
      }
      else {
        this.score+=10;
        this.scoreText.setText('Puntos: '+ this.score);
      }

    });
    this.physics.add.overlap(this.trainsGroup, this.waterGroup, (o1,o2) => {
      console.log(o2.avoidable);
      if(!o2.avoidable) this.EndGame();
    });

    this.physics.add.collider(this.passengersGroup, this.backgroundLayer, (o1,o2) => {
      o1.destroy();
      this.createPassenger();
    });
    this.physics.add.collider(this.boxsGroup, this.backgroundLayer, (o1,o2) => {
      o1.destroy();
      this.createBox();
    });
    this.physics.add.overlap(this.waterGroup, this.backgroundLayer, (o1,o2) => {
      if(o2.collides){
        console.log(o2.collides);
        o1.destroy();
        this.createWater();
      }

    });
    this.physics.add.collider(this.trainsGroup, this.backgroundLayer, () => {
      this.EndGame();
    });

    this.input.on('pointerdown', (pointer)=>{
      let pointerC = Math.floor((pointer.x/TILE_SIZE));
      let pointerR = Math.floor((pointer.y/TILE_SIZE))
      let pointerPos = {column: pointerC,row: pointerR};
      let objectReturned = this.SearchWater(pointerPos);
      if(objectReturned.found && objectReturned.water.avoidable){
        objectReturned.water.SetAvoidable(false);
      }
    });

    this.esc.on('up',()=>{
      this.scene.launch('pause');
      this.scene.pause(this);
    });
    // this.input.on('pointerdown', (pointer,gameObject)=>{
    //   let column = Math.floor(pointer.worldX / 50)
    //   console.log(column);
    //   console.log(gameObject);
    // });

  //   this.input.on('pointerdown', function (pointer) {
  //     console.log(pointer.x);
  //     this.scene.inventory.ModifyRailCounter(-1);
  //     console.log("222");
  // });
    // new Rail(this, 10, 10, 'Railsprite', this.input.activePointer, 0);

    this.inventory = new Inventory(this,(POOL_LENGTH/2)-1);
    for(let i = 0; i < POOL_LENGTH; i++)
    {
      //el tipo de rail definira su angulo
      let railType = 4 * (i % 2);
      
      if (railType == 0) {
        this.railPool[i] = new Rail(this, 24, 8, 'curvedrailsprite', this.input.activePointer, railType, TILE_SIZE,this.inventory);

      }
      else {
        this.railPool[i] = new Rail(this, 26, 8, 'railsprite', this.input.activePointer, railType, TILE_SIZE,this.inventory);

      }
      
      //ademas de crearlos se añaden al grupo de colisiones
      this.railsGroup.add(this.railPool[i]);

      // console.log(this.railPool[i].ReturnTile());
      // console.log(this.railPool[i].ReturnOrientation());
    }

  }
  update()
  {
    //Nota: como ya no se puede comprobar la posición exacta del tren con el rail para cambiar la direccion (porque con las fisicas se salta frames) hay que poner un pequeño offset en las comprobaciones
    //y abarcar todos los casos en Compatible();
    //si se superponen trenes y railes
    if(this.Exit()){
      this.EndGame();
    }
    this.physics.overlap(this.trainsGroup,this.railsGroup,(o1, o2) => {
      //comprueba si el rail es compatible con el tren, es decir, si puede entrar por ese lado del rail
      if(!o1.Compatible(o2)) this.EndGame();
    });
    

    this.CheckAestheticRails();
  }
  createNewTrain()
  {
    let tailDir = this.trainArray[this.trainArray.length - 1].ReturnDirection();
    let tailPos = this.trainArray[this.trainArray.length - 1].ReturnPos();
    let trainPos;

    if (Math.abs(tailDir) == 2) trainPos = { x: tailPos.x, y: tailPos.y - TILE_SIZE * tailDir / 2};
    else trainPos = { x: tailPos.x - TILE_SIZE * tailDir, y: tailPos.y};

    this.trainArray[this.trainArray.length] = new Train(this, trainPos.x, trainPos.y, 'trainsprite', INITIAL_TRAIN_SPEED, tailDir);
    this.trainsGroup.add(this.trainArray[this.trainArray.length - 1]);
  }

  createPassenger()
  {
    let tile = {column: Math.floor(Math.random() * (COLUMNS-5)), row: Math.floor(Math.random() * ROWS)};
    this.passenger = new Collectible(this, tile.column, tile.row, 'passengersprite');
    this.passengersGroup.add(this.passenger);
  }
  createBox()
  {
    let tile = {column: Math.floor(Math.random() * (COLUMNS-5)), row: Math.floor(Math.random() * ROWS)};
    this.box = new Collectible(this, tile.column, tile.row, 'boxsprite');
    this.boxsGroup.add(this.box);
  }
  createWater(){
    let tile;
    //con este do, se evita que se cree agua debajo del tren y deja margen para que avance
    do{
       tile = {column: Math.floor(Math.random() * (COLUMNS-5)), row: Math.floor(Math.random() * ROWS)};
    }while(tile.column==11 && tile.row>=12);
    this.water = new Water(this, tile.column, tile.row, 'watersprite');
    this.waterGroup.add(this.water);
  }

  changeTrainSpeed()
  {
    for(let i = 0; i < this.trainArray.length; i++)
    {
      this.trainArray[i].ChangeSpeed(this.currentSpeed);
    }
  }
  //si quedan 2 railes de un tipo en el inventario, genera nuevos.
  CreateRail(){
    let counters = this.CheckRails();
    if(counters.curvedRails<=1){
      let rail =  new Rail(this, 24, 8, 'curvedrailsprite', this.input.activePointer, 0, TILE_SIZE,this.inventory)
      this.railPool[this.railPool.length] =rail;
      this.railsGroup.add(rail);
    }
    if (counters.straightRails<=1){
      let rail =  new Rail(this, 26, 8, 'railsprite', this.input.activePointer, 4, TILE_SIZE,this.inventory)
      this.railPool[this.railPool.length] = rail;
      this.railsGroup.add(rail);
    }
    
    // console.log("lenght"+this.railPool.length);
  }

  CheckRails(){
    let counters={curvedRails:0,straightRails:0};
    for(let i = 0; i < this.railPool.length; i++)
    {
      let tile = this.railPool[i].ReturnTile();
      if(this.railPool[i].ReturnRailType()===0 && tile.column === 24){counters.curvedRails++;}
      else if(this.railPool[i].ReturnRailType()===4 && tile.column === 26){counters.straightRails++;}
    }
    // console.log("C"+counters.curvedRails);
    // console.log("S"+counters.straightRails);
    return counters;
  }

  CheckAestheticRails()
  {
    let flag = false;
    let aestheticRailTile;
    let trainHeadTile = this.trainArray[0].ReturnTile();

    this.AestheticRailsCreation(flag, aestheticRailTile, trainHeadTile);

    flag = false;
    aestheticRailTile = {column: Math.floor(this.aestheticRails[0].getCenter().x / TILE_SIZE), row: Math.floor(this.aestheticRails[0].getCenter().y / TILE_SIZE) }
    this.AestheticRailsDestruction(flag, aestheticRailTile, trainHeadTile);
  }

  AestheticRailsCreation(flag, aestheticRailTile, trainHeadTile)
  {
    let i = 0;
    let trainHeadDir = this.trainArray[0].ReturnDirection();

    if(this.aestheticRails.length > 0) 
    {   
      aestheticRailTile = {column: Math.floor(this.aestheticRails[this.aestheticRails.length - 1].getCenter().x / TILE_SIZE), 
      row: Math.floor(this.aestheticRails[this.aestheticRails.length - 1].getCenter().y / TILE_SIZE) }

      if (aestheticRailTile.column === trainHeadTile.column && aestheticRailTile.row === trainHeadTile.row) flag = true;

      while(!flag && i < this.railPool.length) 
      {
        let curvedRailTile = this.railPool[i].ReturnTile();
        if (aestheticRailTile.column === curvedRailTile.column && aestheticRailTile.row === curvedRailTile.row) flag = true;
        i++;
      }
    }

    if(!flag)
    {
      this.aestheticRails[this.aestheticRails.length] = this.add.sprite(trainHeadTile.column * TILE_SIZE + TILE_SIZE / 2, trainHeadTile.row * TILE_SIZE + TILE_SIZE / 2, 'railsprite');
      if(trainHeadDir % 2 !== 0) this.aestheticRails[this.aestheticRails.length - 1].setAngle(90);
    } 
  }

  AestheticRailsDestruction(flag, aestheticRailTile, trainHeadTile)
  {
    let i = 0;

    while(!flag && i < this.trainArray.length) 
    {
      trainHeadTile = this.trainArray[i].ReturnTile();
      if (aestheticRailTile.column === trainHeadTile.column && aestheticRailTile.row === trainHeadTile.row) flag = true;
      i++;
    }

    if(!flag)
    {
      this.aestheticRails[0].destroy();
      this.aestheticRails.shift();
    }

    i = 0;
    
    while(flag && i < this.railPool.length) 
    {
      let curvedRailTile = this.railPool[i].ReturnTile();
      if (aestheticRailTile.column === curvedRailTile.column && aestheticRailTile.row === curvedRailTile.row)
      {
        this.aestheticRails[0].destroy();
        this.aestheticRails.shift();
        flag = false;
      }
      i++;
    }
  }

  Exit(){
    let pos;
    pos = this.trainArray[0].ReturnPos();
    if(pos.x < TILE_SIZE/3 || pos.y < TILE_SIZE/3 || pos.y > (TILE_SIZE * ROWS)-TILE_SIZE/3) return true;
  }
  SearchWater(pointerPos){
    let waterArray = this.waterGroup.getChildren();
    let found = false;
    let waterFound;
    for (let i = 0;i<waterArray.length && !found;i++){
      if(waterArray[i].column === pointerPos.column && waterArray[i].row === pointerPos.row) {
        found = true;
        waterFound = waterArray[i];
      }
    }
    let returnObject = {found: found,water: waterFound};
    return returnObject;

  }
  EndGame(){
    this.scene.pause(this);
    let endScene = this.scene.get('end');
    if(endScene===null){
      this.scene.add('end',new EndMenu(this.score));
      this.scene.launch('end');
    }
  }
  // changeState(state)
  // {
  //   this.state = state;

  //   for(let i = 0; i < POOL_LENGTH; i++)
  //   {
  //     this.railPool[i].ChangeState(state);
  //   }

  //   for(let i = 0; i < this.trainArray.length; i++)
  //   {
  //     this.trainArray[i].ChangeState(state);
  //   }
  // }
}
