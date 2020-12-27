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
const dotenv        = require('dotenv');
const express       = require("express");
const bodyParser    = require("body-parser");
const corsEnable    = require("cors");
const mysql         = require("mysql");

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
	case "Mongo":
        {
            break;
        }
    default:
        {
            break;
        }
	}
};//connectorDB

//-----------SERVER ROUTING---------------//
serverObj.get("/requestArticles/orderColumn/:field/orderDirection/:direction/startRow/:start/endRow/:end", (req, res) => {
    //Generic failure message
    const failMsg = "Lo sentimos. No ha sido posible obtener los datos en este momento. Inténtelo más tarde";

    //--CREATE A CONNECTION WITH DB--//
    connectorDB("MySQL", connectionData)
    .then((connectionDB) => {
        //Created connection with DB --> GO ON
        try {
            connectionDB.query({
                sql : req.params.direction === 'ASC' ? "SELECT * FROM articulos ORDER BY ?? ASC LIMIT ?, ?;" : "SELECT * FROM articulos ORDER BY ?? DESC LIMIT ?, ?;",
                values : [
                    req.params.field,           //field use for ordering
                    parseInt(req.params.start), //starting row of recordset to retrieve
                    parseInt(req.params.end)    //end row of recordset to retrieve
                ]},
                function (err, result) {
                    if (err)
                    {
                        //Query failed
                        throw err;
                    }//if
                    else if (result.length)
                    {
                        connectionDB.end();
                        //Send back the result
                        res.send({"ret" : true, "caption" : result});
                    }//else if
                    else
                    {
                        connectionDB.end();
                        console.log("");
                        res.send({"ret" : false, "caption" : failMsg});
                    }//else
                });
            } catch(err){
                connectionDB.end();
                console.log("Fallo en sentencia SQL",err);
                res.send({"ret" : false, "caption" : failMsg});
            }
    })
    //DB connection KO --> exit
    .catch((fail) => {
        //The connection with DB failed --> Exit sending error information
        console.log("Fallo de conexión con la BD",fail);
        res.send({"ret" : false, "caption" : failMsg});
    });
});