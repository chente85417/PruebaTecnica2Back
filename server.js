////////////////////////////////////////////
//              THE BRIDGE                //
//                                        //
//       TECHNICAL TRIAL Sept 2020        //
//                                        //
////////////////////////////////////////////
//                                        //
//Developer:                              //
//  Vicente Alejandro Garcerán Blanco     //
//  vagb.fullstack@gmail.com              //
//                                        //
//    Main Express backend server file    //
//                                        //
////////////////////////////////////////////

//---------------MODULES------------------//
const dotenv            = require('dotenv');
const express           = require("express");
const bodyParser        = require("body-parser");
const corsEnable        = require("cors");
const mysql             = require("mysql");
const { MongoClient }   = require("mongodb");

//------------INITIALIZATION--------------//
//Loading of environment variables
dotenv.config();

//Creation of Express server object
const serverObj = express();

//Raise Express server on listening port
serverObj.listen(process.env.PORTBACK || 8888, () => {console.log(`Express server listening on port ${process.env.PORTBACK}`)});

//Data connection to MySQL
const connectionData = {
    "host" : process.env.DB_HOST,
    "user" : process.env.DB_USER,
    "password" : process.env.DB_PASSWORD,
    "database" : process.env.DB_DATABASE
};

//Message to notify of failed operation
const failMsg = "Lo sentimos. No ha sido posible obtener los datos en este momento. Inténtelo más tarde";

let DBEngine = "MySQL";

//-------------MIDDLEWARES----------------//
const publicFiles = express.static("src");//For developing
//const publicFiles = express.static(__dirname + "/build");//For production
serverObj.use(publicFiles);
serverObj.use(bodyParser.urlencoded({"extended" : false}));
serverObj.use(bodyParser.json());
serverObj.use(corsEnable());

//-------------FUNCTIONS----------------//
const connectorDB = (dbms, connectionData) => {
	let connectionDB = null;
	switch (dbms) {
	case "MySQL":
        {
            const prom = new Promise((resolve, reject) => {
                if (mysql !== undefined)
                {
                    if (typeof connectionData !== "object")
                    {
                        reject({"ret" : 0, "msg" : "MySQL connection data is not a valid JSON"});
                    }//if
                    try { connectionDB = mysql.createConnection(connectionData); }
                    catch (e) { reject({"ret" : 0, "msg" : `Unable to create MySQL connection. Please check connection data is correct`});
                    }
                    if (connectionDB)
                    {
                        connectionDB.connect(function(err) {
                            if (err)
                            {
                                reject({"ret" : 0, "msg" : err});
                            }//if
                            resolve(connectionDB);
                        });
                    }//if
                }//if
                else
                {
                    reject({"ret" : 0, "msg" : `MySQL connection failed. MySQL driver not found`});
                }//else
            });
            return prom;
        }
	case "MongoDB":
        {
            const prom = new Promise((resolve, reject) => {
                if (MongoClient !== undefined)
                {
                    if (typeof connectionData !== "object")
                    {
                        reject({"ret" : 0, "msg" : "connection data is not a valid JSON"});
                    }//if
                    try {
                        //Uri string connection to mongodb instance
                        const mongoConnectionData = `mongodb://${connectionData.host}:27017`;
                        const client = new MongoClient(mongoConnectionData, {useUnifiedTopology: true});
                        //console.log(client);

                        client.connect(function(err) {
                            if (err)
                            {
                                reject({"ret" : 0, "msg" : err});
                            }//if
                            else
                            {
                                resolve(client);
                            }//else
                        });
                    } catch (e) {
                        reject({"ret" : 0, "msg" : `Unable to create MongoDB connection. Please check connection data is correct`});
                    }
                }//if
                else
                {
                    reject({"ret" : 0, "msg" : `MongoDB connection failed. MongoDB driver not found`});
                }//else
            });
            return prom;
        }
    default:
        {
            break;
        }
	}
};//connectorDB

const MakeQuery = (dataQuery, response) => {
    //--CREATE A CONNECTION WITH DB--//
    connectorDB(DBEngine, connectionData)
    .then((connectionDB) => {
        //Created connection with DB --> GO ON
        if (DBEngine === "MySQL")
        {
            try {
                connectionDB.query(dataQuery,
                    function (err, result) {
                        if (err)
                        {
                            //Query failed
                            throw err;
                        }//if
                        else// if (result.length)
                        {
                            connectionDB.end();
                            //Send back the result
                            response.send({"ret" : true, "caption" : result});
                        }//else if
                        /*else
                        {
                            connectionDB.end();
                            console.log("");
                            response.send({"ret" : false, "caption" : failMsg});
                        }//else*/
                    });
                }
            catch(err) {
                    connectionDB.end();
                    console.log("Fallo en sentencia SQL",err);
                    response.send({"ret" : false, "caption" : failMsg});
                }
        }//if
        else if (DBEngine === "MongoDB")
        {
            try {
                if (dataQuery.leftJoin)
                {
                    //console.log(dataQuery);
                    new Promise(function(resolve, reject) {
                        const collection = connectionDB.db(connectionData.database).collection(dataQuery.collection);
                        collection.find(dataQuery.query, dataQuery.options.projection).toArray(
                            function(err, docs)
                            {
                                if (err)
                                {
                                    //console.log("El error: ".err);
                                    reject(err); 
                                }//if
                                else
                                {
                                    //console.log(docs);
                                    if (docs.length)
                                    {
                                        const joinCollection = connectionDB.db(connectionData.database).collection(dataQuery.leftJoin.collection);
                                        let queryObject = {};
                                        queryObject[`${dataQuery.leftJoin.foreign}`] = docs[0][dataQuery.leftJoin.key];
                                        joinCollection.find(queryObject, {_id : 0}).toArray(
                                            function(err, docs)
                                            {
                                                if (err)
                                                {
                                                    //console.log("El error: ".err);
                                                    reject(err); 
                                                }//if
                                                else
                                                {
                                                    console.log(docs);
                                                    resolve(docs);
                                                }//else
                                            });
                                    }//if
                                    else
                                    {
                                        resolve([]);
                                    }//else
                                }//else
                            });
                        }).then(res => response.send({"ret" : true, "caption" : res}))
                        .catch(err => response.send({"ret" : false, "caption" : failMsg}));
                }//if
                else
                {
                    new Promise(function(resolve, reject) {
                        const collection = connectionDB.db(connectionData.database).collection(dataQuery.collection);
                        collection.find(dataQuery.query, dataQuery.options.projection)
                        .sort(dataQuery.options.sort)
                        .skip(dataQuery.options.skip)
                        .limit(dataQuery.options.limit)
                        .toArray(
                            function(err, docs)
                            {
                                if (err)
                                {
                                    //console.log("El error: ".err);
                                    reject(err); 
                                }//if
                                else
                                {
                                    console.log(docs);
                                    resolve(docs);
                                }//else
                            });
                        }).then(res => response.send({"ret" : true, "caption" : res}))
                        .catch(err => response.send({"ret" : false, "caption" : failMsg}));
                }//else
                }
            catch(err) {
                    connectionDB.close();
                    console.log("Fallo en sentencia SQL",err);
                    response.send({"ret" : false, "caption" : failMsg});
                }
        }//else if
    })
    //DB connection KO --> exit
    .catch((fail) => {
        //The connection with DB failed --> Exit sending error information
        console.log("Fallo de conexión con la BD",fail);
        response.send({"ret" : false, "caption" : failMsg});
    });
};//MakeQuery

const Notify = (data) => {
    console.log(`Invoked endpoint: ${data}
    DB Engine asked: ${DBEngine}`);
};//Notify

//-----------SERVER ROUTING---------------//
/*
    This endpoint sets current DB Engine
    All queries will be done using current DB Engine
*/
serverObj.get("/setDBEngine/:engine", (req, res) => {
    DBEngine = req.params.engine;
    console.log(`DB Engine switched to ${DBEngine}`);
    res.send({"ret" : true, "caption" : "Ok"});
});
/*
    This endpoint retrieves a bunch of "end" products beginning from "start" ordered according to "direction" over "field"
    It is used when the user operates the header sorting controls and the footer range controls
*/
serverObj.get("/requestArticles/orderColumn/:field/orderDirection/:direction/startRow/:start/endRow/:end", (req, res) => {
    Notify(req.url);
    let queryData = undefined;
    if (DBEngine === "MySQL")
    {
        queryData =   {
            sql : req.params.direction === 'ASC' ?
                    "SELECT * FROM articulos ORDER BY ?? ASC LIMIT ?, ?;" :
                    "SELECT * FROM articulos ORDER BY ?? DESC LIMIT ?, ?;",
            values :    [
                            req.params.field,           //field used for ordering
                            parseInt(req.params.start), //starting row of recordset to retrieve
                            parseInt(req.params.end)    //number of records to retrieve
                        ]
        };
    }//if
    else if (DBEngine === "MongoDB")
    {
        let sortObject = {};
        sortObject[`${req.params.field}`] = req.params.direction === 'ASC' ? 1 : -1;
        queryData = {
            collection : "articulos",
            query : {},
            options : {
                projection : {_id : 0},
                sort : sortObject,
                skip : parseInt(req.params.start),
                limit : parseInt(req.params.end)
            }
        };
    }//else if

    MakeQuery(queryData, res);
});

/*
    This endpoint retrieves the data from the manufacturer of one particular product given its ID
    It is used when the user selects one product on the table
*/
serverObj.get("/requestManufacturer/:artID", (req, res) => {
    Notify(req.url);
    let queryData = undefined;
    if (DBEngine === "MySQL")
    {
        queryData =   {
            sql : "SELECT f.*, a.ARTID FROM fabricantes AS f LEFT JOIN articulos AS a ON f.FABID = a.EXT_FABID WHERE a.ARTID = ?;",
            values :    [
                            req.params.artID    //article id
                        ]
        };
    }//if
    else if(DBEngine === "MongoDB")
    {
        let queryObject = {};
        queryObject["ARTID"] = parseInt(req.params.artID);
        queryData = {
            collection : "articulos",
            query : queryObject,
            options : {
                projection : {_id : 0, EXT_FABID : 1}
            },
            leftJoin : {
                collection : "fabricantes",
                foreign : "FABID",
                key : "EXT_FABID"
            }
        };
    }//else if
    MakeQuery(queryData, res);
});

/*
    This endpoint retrieves all products whose names include "name"
    It is used to fill the predictive search list of products each time the user changes the search input
    MongoDB: db.articulos.find({"NOMBRE" : {$regex : /.*xx.* /, $options : 'i'}})
*/
serverObj.get("/requestProducts/:name", (req, res) => {
    Notify(req.url);
    let queryData = undefined;
    if (DBEngine === "MySQL")
    {
        queryData =   {
            sql : "SELECT ARTID, NOMBRE FROM articulos WHERE NOMBRE LIKE ?;",
            values :    [
                            `%${req.params.name}%`  //article name hint
                        ]
        };
    }//if
    else if(DBEngine === "MongoDB")
    {    
        queryData = {
            collection : "articulos",
            query : {NOMBRE : {$regex: new RegExp(`.*${req.params.name}.*`, 'i')}},
            options : {
                projection : {_id : 0, ARTID : 1, NOMBRE : 1},
                sort : {},
                skip : 0,
                limit : 0
            }
        };
    }//else if
    MakeQuery(queryData, res);
});

/*
    This endpoint retrieves all manufacturers whose names include "name"
    It is used to fill the predictive search list of manufacturers each time the user changes the search input
*/
serverObj.get("/requestManufacturers/:name", (req, res) => {
    Notify(req.url);
    let queryData = undefined;
    if (DBEngine === "MySQL")
    {
        queryData =   {
            sql : "SELECT FABID, NOMBRE FROM fabricantes WHERE NOMBRE LIKE ?;",
            values :    [
                            `%${req.params.name}%`  //manufacturer name hint
                        ]
        };
    }//if
    else if(DBEngine === "MongoDB")
    {
        queryData = {
            collection : "fabricantes",
            query : {NOMBRE : {$regex: new RegExp(`.*${req.params.name}.*`, 'i')}},
            options : {
                projection : {_id : 0, FABID : 1, NOMBRE : 1},
                sort : {},
                skip : 0,
                limit : 0
            }
        };
    }//else if
    MakeQuery(queryData, res); 
});

/*
    This endpoint retrieves all data from a particular product using its ID
    It is used when the user selects one product from the predictive searching list
*/
serverObj.get("/searchArticle/:artID", (req, res) => {
    Notify(req.url);
    let queryData = undefined;
    if (DBEngine === "MySQL")
    {
        queryData =   {
            sql : "SELECT * FROM articulos WHERE ARTID = ?;",
            values :    [
                            req.params.artID    //article id
                        ]
        };
    }//if
    else if(DBEngine === "MongoDB")
    {
        let queryObject = {};
        queryObject["ARTID"] = parseInt(req.params.artID);
        queryData = {
            collection : "articulos",
            query : queryObject,
            options : {
                projection : {_id : 0},
                sort : {},
                skip : 0,
                limit : 0
            }
        };
    }//else if
    MakeQuery(queryData, res);
});

/*
    This endpoint retrieves all products from a particular manufacturer using its ID
    It is used when the user selects one manufacturer from the predictive searching list
*/
serverObj.get("/searchArticlesFromManufacturer/:fabID", (req, res) => {
    Notify(req.url);
    let queryData = undefined;
    if (DBEngine === "MySQL")
    {
        queryData =   {
            sql : "SELECT a.* FROM articulos AS a LEFT JOIN fabricantes AS f ON f.FABID = a.EXT_FABID WHERE f.FABID = ?;",
            values :    [
                            req.params.fabID    //manufacturer´s name
                        ]
        };
    }//if
    else if(DBEngine === "MongoDB")
    {
        let queryObject = {};
        queryObject["EXT_FABID"] = parseInt(req.params.fabID);
        queryData = {
            collection : "articulos",
            query : queryObject,
            options : {
                projection : {_id : 0},
                sort : {},
                skip : 0,
                limit : 0
            }
        };
    }//else if
    MakeQuery(queryData, res);
});

/*
    This endpoint retrieves the data from a particular product given its name
    It is used when the user clicks the Ok button of the search section
*/
serverObj.get("/getArticleFromName/:name", (req, res) => {
    Notify(req.url);
    let queryData = undefined;
    if (DBEngine === "MySQL")
    {
        queryData =   {
            sql : "SELECT * FROM articulos WHERE NOMBRE = ?;",
            values :    [
                            req.params.name //article´s name
                        ]
        };
    }//if
    else if(DBEngine === "MongoDB")
    {
        let queryObject = {};
        queryObject["NOMBRE"] = req.params.name;
        queryData = {
            collection : "articulos",
            query : queryObject,
            options : {
                projection : {_id : 0},
                sort : {},
                skip : 0,
                limit : 0
            }
        };
    }//else if
    MakeQuery(queryData, res);
});

/*
    This endpoint retrieves all products from one particular manufacturer given its name
    It is used when the user clicks the Ok button of the search area
*/
serverObj.get("/getArticlesFromManufacturerName/:name", (req, res) => {
    Notify(req.url);
    let queryData = undefined;
    if (DBEngine === "MySQL")
    {
        queryData =   {
            sql : "SELECT a.* FROM articulos AS a LEFT JOIN fabricantes AS f ON f.FABID = a.EXT_FABID WHERE f.NOMBRE = ?;",
            values :    [
                            req.params.name //manufacturer´s name
                        ]
        };
    }//if
    else if(DBEngine === "MongoDB")
    {
        let queryObject = {};
        queryObject["NOMBRE"] = req.params.name;
        queryData = {
            collection : "fabricantes",
            query : queryObject,
            options : {
                projection : {_id : 0, FABID : 1}
            },
            leftJoin : {
                collection : "articulos",
                foreign : "EXT_FABID",
                key : "FABID"
            }
        };
    }//else if
    MakeQuery(queryData, res);
});