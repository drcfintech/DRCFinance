const Koa = require('koa');
const router = require('koa-router')();
const bodyParser = require('koa-bodyparser');
const MongoClient = require('mongodb').MongoClient;
const Monk = require('monk');
//model
var app = new Koa();
const db = new Monk('localhost/drcbase');
const testdata = db.get('schooldata');

router.get('/', async (ctx) => {
    //
    console.log("1");
});
router.post('/add', async (ctx) => {
    console.log("333");
    //
    testdata.insert({name: "zhangsan", age: "33"});
    //s
    console.log("insert is ok ");

});

//
router.get('/',async(ctx,next)=>{
    //
    if (!ctx.request.query.account){
        //
        ctx.body = await Promise.resolve({
            code:20002,
            data:{},
            message:'address'
        });
    }
    //
    var transations = await  ActionMongoDB.queryAccountTransationData(ctx.request.query.account);
    ctx.body = await  Promise.resolve({
        code:1000,
        transations:transations,
        message:'ok',
    });
});

//
router.get('/transation/syncTransations',async (ctx,next)=>{
    //
    //todo
// 01. 防止重复请求重复同步
// 02. 如果数据库中不存在本地区块号，先初始化数据库区块号数据
    console.log('=====> Checking database data has init?');
    var localBlockNumber = await  ActionMongoDB.getLatestLocalBlockNum();
    if (localBlockNumber == 0){
        //
        console.log('The local blockNum in the database does not exist.');
        await ActionMongoDB.initDatabaseData();
    }else{
        //
        console.log('The database data has already init before.');
    }
    console.log('============================================================');

    //判断上一次本地最新区块下的交易是否同步完成，若未完成，先同步完该区块交易
    console.log('============================================================');
    console.log('=====> Checking last local block transations has complete sync?');
    var transactionCount = await  ActionMongoDB.getBlockTransactionCounts(localBlockNumber);
    console.log('localBlockNumber[' + localBlockNumber + ']' + ' transactionCount on mainNet is ' + transactionCount);

    if (transactionCount == 0){
        console.log('Block ' + localBlockNumber + ' has no transation data.');
    }else{
        //
        // 如果有，判断是否需要继续同步
        if ((transactionCount-1)>await ActionMongoDB.getLatestLocalTransationIndex()){
            //
            console.log('Not all of transations, Continue sync block transations... ...');

            tools.isSync = true;

            //

            //从最后一条交易记录的下一条开始获取并插入
            for (var i=(await ActionMongoDB.getLatestLocalTransationIndex()+1);i<transactionCount;i++){
                //
                await web3.eth.getTransactionFromBlock(localBlockNumber,i)
                    .then(async response=>{
                        //
                        // 插入交易数据
                        await  ActionMongoDB.insertTransationData(response,localBlockNumber,i);
                        // 更新数据库的dataBaselocalBlockNumber和dataBaselocalTransationIndex
                        await ActionMongoDB.updateDataBaselocalBlockNumber(localBlockNumber,i);

                        //
                        console.log(moment().format('LLLL'));
                    });
            }
            //
            console.log('Complete sync block ' +
                localBlockNumber + ' of ' + transactionCount + ' transations.');
            tools.isSync = false;
        }else{
            //
            console.log('No need sync.Local block has full of ' + transactionCount + ' transations.');
        }
    }
    //  先查看该区块中是否有交易
    console.log('============================================================');


    //比较主网和本地的区块号并决定是否进行同步
    console.log('============================================================');
    console.log('=====> Checking local block is the latested?');

    //
    var nextLocalBlockNumber;
    var blockTransactionCount;

    //
    while (await ActionMongoDB.getPrevBlockNum()>await ActionMongoDB.getLatestLocalBlockNum()){
        //
        console.log('Not the latested, Prepare Sync......');

        //
        tools.isSync = true;

        //获取数据库最新一条交易记录的区块号的下一个区块号
        blockTransactionCount = await ActionMongoDB.getBlockTransactionCounts(nextLocalBlockNumber);
        //
        //
        // 判断区块内是否包含交易，如果为0，只需要更新下数据库的区块号
        if (blockTransactionCount ==0){
        //
            console.log('Block ' + nextLocalBlockNumber + ' has no transation data.');

            await  ActionMongoDB.updateDataBaselocalBlockNumber(nextLocalBlockNumber,0);

        }else{
            //
            console.log('Block ' + nextLocalBlockNumber + ' isSyncing......');

            // 获取该区块下的交易数据

            for (var i = 0;i<blockTransactionCount;i++){
                //
                await  web3.eth.getTransactionFromBlock(nextLocalBlockNumber,i)
                    .then(async response=>{
                        //
                        // 插入交易数据
                        await ActionMongoDB.insertTransationData(response,nextLocalBlockNumber,i);
                        // 更新数据库的dataBaselocalBlockNumber和dataBaselocalTransationIndex
                        await ActionMongoDB.updateDataBaselocalBlockNumber(nextLocalBlockNumber,i);

                        console.log(moment().form('LLLL'));
                    });
            }
        }
    }
    //
    tools.isSync == false;

    //
    console.log('The current local block is the latest.');
    console.log('Finish Sync.');
    console.log('============================================================');

});

//
var ActionMongoDB = {
    //
    //获取当前最新区块的前一个区块数
    getPrevBlockNum: async () => {
        //
        var currentBlockNum = await web3.eth.getBlockNumber();
        //
        var prevBlockNum = currentBlockNum - 1;
        console.log('===================================');
        console.log('currentBlockNum: ' + currentBlockNum);
        console.log('prevBlockNum: ' + prevBlockNum);
        return prevBlockNum;
    },

    getBlockTransactionCounts: async (blockNum) => {
        //获取当前区块前一个区块下的所有交易数量
        var transationCountByBlockNum = await web3.eth.getBlockTransactionCount(blockNum);

        //
        if (transationCountByBlockNum == null) throw 'Error: The transationCountByBlockNum is null, please try again later.';
        console.log('blockNum:' + blockNum + 'transationCountByBlockNum' + transationCountByBlockNum);
        //
        return transationCountByBlockNum;
    },

    //向数据库插入交易记录
    insertTransationData: async (response, blockNum, index) => {
        //
        return new Promise((resolve, reject) => {
            //
            MongoClient.connect(config.databaseUrl, (err, db) => {
                if (err) reject(err);
                //
                var dbo = db.db(config.databaseName);

                // insert
                dbo.collection(config.tableName).insertOne(response, (err, res) => {
                    //
                    if (err) reject(err);
                    console.log("Insert success! BlockNum: " + blockNum + ' index: ' + index);
                    //
                    db.close();
                    resolve();
                });
            });
        });
    },

    //  初始化数据库，插入第一条数据，将dataBaselocalBlockNumber和dataBaselocalTransationIndex设为0
    initDatabaseData: () => {
        return new Promise((resolve, reject) => {
            //
            MongoClient.connect(config.databaseUrl, (err, db) => {
                //
                if (err) reject(err);
                var dbo = db.db(config.databaseName);
                var initData = {dataBaselocalBlockNumber: 0, dataBaselocalTransationIndex: 0};
                dbo.collection(config.tableName).insertOne(initData, (err, res) => {
                    //
                    if (err) reject(err);
                    console.log("Init database data success.");
                    db.close();
                    resolve();
                });
            });
        });
    },

    //更新数据库的dataBaselocalBlockNumber和dataBaselocalTransationInde
    updateDataBaselocalBlockNumber:(localBlockNumber,transationIndex)=>{
        //
        return new Promise((resolve, reject) =>{
            //
           MongoClient.connect(config.databaseUrl,(err,db)=>{
               //
               if(err) reject(err);
               //
               var dbo = db.db(config.databaseName);
               //
               var whereStr = {
                   dataBaselocalBlockNumber: {
                       $exists:true
                   }
               }
               var updateStr = {
                   $set: {
                       dataBaselocalBlockNumber: localBlockNumber,
                       dataBaselocalTransationIndex: transationIndex
                   }
               };
               dbo.collection(config.tableName).updateOne(whereStr,updateStr,(err,res)=>{
                   //
                   if (err) reject(err);

                   //
                   console.log("Update dataBaselocalBlockNumber: " + localBlockNumber +
                       " dataBaselocalTransationIndex: " + transationIndex);
                db.close();
                resolve();
               });
           });
        });
    },

    // 获取数据库记录的已同步的区块号

    getLatestLocalBlockNum:()=>{
        //
        return new Promise((resolve, reject) => {
            //
            MongoClient.connect(config.databaseUrl,(err,db)=>{
              if (err)reject(err);

              var dbo = db.db(config.databaseName);
              dbo.collection(config.tableName).find({
                  dataBaselocalBlockNumber:{
                      $exists: true
                  }
              }).toArray(async (err,result)=>{
                  //
                  if (err) reject(err);
                  var localBlockNumber;
                  var localTransationIndex;

                  //
                  // 先判断数据库的blockNum字段和transationIndex字段是否有值，没有的话都设为0
                  if (result.length ===0){
                      //不同步创世区块(block[0])
                      localBlockNumber = 0;
                      localTransationIndex = 0;
                  }else{
                      //if have
                      localBlockNumber = result[0].dataBaselocalBlockNumber;
                      localTransationIndex =  result[0].dataBaselocalTransationIndex;
                  }
                  console.log('Latest localBlockNumber: ' + localBlockNumber +
                      ' & localTransationIndex ' + localTransationIndex);

                  //
                  db.close();
                  resolve(localBlockNumber);
              });
            });
        });
    },

    // 获取数据库记录的已同步的区块号的交易index
    getLatestLocalTransationIndex:()=>{
        //
        return new Promise((resolve, reject) => {
            //
            MongoClient.connect(config.databaseUrl,(err,db)=>{
                //
                if (err) reject(err);
                //
                var dbo = db.db(config.databaseName);

                dbo.collection(config.databaseName).find({
                    //
                    dataBaselocalTransationIndex:{
                        //
                        $exists:true
                    }
                }).toArray(async (err,result)=>{
                    //
                    if (err) reject(err);
                    //
                    var localBlockNumber;
                    var localTransationIndex;
                    //
                    if (result.length ===0){
                        //
                        localBlockNumber =0;
                        localTransationIndex = 0;

                    } else{
                        //if have
                        localBlockNumber = result[0].dataBaselocalBlockNumber;
                        localTransationIndex =  result[0].dataBaselocalTransationIndex;
                        console.log('localTransationIndex ' + localTransationIndex);
                        //
                        db.close();
                        resolve(localTransationIndex);
                    }
                });
            });
        });
    },

    // 在数据库中查询指定账号的交易
    queryAccountTransationData:async (account)=>{
        //
        return new Promise((resolve, reject) => {
            //
            MongoClient.connect(config.databaseUrl,(err,db)=>{
                //
                if (err) reject(err);
                var dbo = db.db(config.databaseName);
                var whereStr = {
                    $or:[{
                        form:account
                    },{
                        to:account
                    }]
                };
            //
                dbo.collection(config.tableName).find(whereStr).toArray((err,result)=>{
                    //
                    if (err) reject(err);
                    //
                    console.log('Transations by account ' + account + ':');
                    console.log(result);
                    //
                    db.close();
                    resolve(result);
                });
            });
        });
    }
}
var config = {
    databaseUrl: '',
    databaseName: '',
    tableName: ''
}

var JsonFile = {
    DBurl: () => {
        return "mongodb://localhost:3233/schooldata";
    },
    databaseUrl: 'mongodb://localhost:27017/',
    databaseName: 'blockTRanstionsDB',
    tableName: 'transations'
}
var ActionKoa = {
    //
    use: () => {
        //
        app.use(bodyParser());
        app.use(router.routes());
        app.use(router.allowedMethods);
    },
    listen: () => {
        //
        app.listen(3000);
    }
}
//
var server = {
    //
    start: () => {
        //
        ActionKoa.use();
        ActionKoa.listen();
    }


}

//
server.start();
console.log("starting.........................");
