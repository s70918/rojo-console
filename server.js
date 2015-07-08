// LOAD MODULES =================================================================
var request = require("request");
var express = require('express');
var cheerio = require("cheerio");
var sql = require('mssql');
var bodyParser = require('body-parser')
var app = express();
var router = express.Router();
var port = process.env.PORT || 80;
var config = require('./config/mssql.database.js');
// SETUP EXPRESS APPLICATION ====================================================
app.use(bodyParser.urlencoded({extended: false}));
// VIEW ENGINE
app.set('view engine', 'ejs');
// APPLY TO APP
app.use('/', router);
app.use(express.static('public'));
// START THE SERVER
app.listen(port);
// ROUTES =======================================================================
router.use('/',function(req,res,next){
	console.log('%s %s',req.method,req.url||req.path);
	next();
});
router.get('/', function(req, res) {
	res.render('pages/index');
});
router.get('/report', function(req, res) {
	var connection = new sql.Connection(config, function(err) {
		var sqlRequest = new sql.Request(connection);
		sqlRequest.multiple = true;
		var qs = "SELECT DISTINCT [AppID],[AppName] FROM [Rockpay_v1].[dbo].[v_AppIDCondition] WHERE SUBSTRING([AppID],1,1) = 't' AND [AppID] != 'testapp' ORDER BY [AppID] ASC";
		sqlRequest.query(qs, function(err, recordset) {
			if(err === undefined){
				var sqlResult = recordset[0];
				res.render('pages/report', {apps : sqlResult});
			}else{
				console.log(err);
				connection.close();
			}
		});
		connection.close();
	});
});
router.get('/revenue-chart', function(req, res) {
	var connection = new sql.Connection(config, function(err) {
		var sqlRequest = new sql.Request(connection);
		sqlRequest.multiple = true;
		var qs = "SELECT [Year] = YEAR([Transaction Creation Date]),[Month] = Month([Transaction Creation Date]),[PaymentID],[Payment Channel],SUM([Amount]) AS 'Revenue',[Currency] FROM [v_TransactionData] WHERE [UpdateDate] BETWEEN '2014-06-01 00:00:00.000' and '2015-06-30 23:59:59.999' AND [TransactionStatus] = '2' AND SUBSTRING([AppID],1,1) = 't' AND [AppID] != 'testapp' GROUP BY YEAR([Transaction Creation Date]),Month([Transaction Creation Date]),[PaymentID],[Payment Channel],[Currency] ORDER BY [Year],[Month],[PaymentID],[Currency]";
		sqlRequest.query(qs, function(err, recordset) {
			if(err === undefined){
				var sqlResult = recordset[0];
				res.render('pages/revenue-chart', {data : sqlResult});
				connection.close();
			}else{
				console.log(err);
				connection.close();
			}
		});
	});
});
router.post('/report/api', function(req, res) {
	var queryOption = {
		appid : req.body.id,
		date : req.body.date.split(" - ")
	};
	var sqlResult;
	if(queryOption.appid == null || queryOption.date == null){
		console.log("error");
	}else{
		var connection = new sql.Connection(config, function(err) {
			var sqlRequest = new sql.Request(connection);
			var qs = "SELECT * FROM [v_TransactionData] WHERE [UpdateDate] BETWEEN '" + queryOption.date[0] + " 00:00:00.000' and '" + queryOption.date[1] + " 23:59:59.999' AND [TransactionStatus] = '2' AND [AppID] = '" + queryOption.appid + "' ORDER BY [UpdateDate] ASC" + ";" + "SELECT * FROM [v_AppIDCondition] WHERE [AppID] = '" + queryOption.appid + "'";
			sqlRequest.multiple = true;
			sqlRequest.query(qs, function(err, recordset) {
				sqlResult = recordset;
				res.send(sqlResult);
			});
			connection.close();
		});
	}
});
router.post('/xchangerate/api', function(req, res) {
	request.post({
		url : "http://rate.bot.com.tw/Pages/UIP004/UIP004INQ1.aspx?lang=zh-TW",
		form : {
			"Button3" : "查詢",
			"__EVENTVALIDATION" : "/wEWFAKcnb0HAruTy7MGAr+T8+kHAoyFzvoJAtaywuMCAp/kvpsNAtuCm8QLAsvcuuMKAtbcluMKAtXcluMKAou2zcIBApS2zcIBAtuaiJwEAsSaiJwEAoznisYGAqDCk/ENAqvHvb4NArTHvb4NAtaUz5sCAs+GurEPDkM3TuUtBcj6lusmfXDSVh+hJ1Y=",
			"__VIEWSTATE" : "/wEPDwUKMTYzMjkyNTMyN2QYAwUeX19Db250cm9sc1JlcXVpcmVQb3N0QmFja0tleV9fFgkFCHZpZXcxXzk5BQd2aWV3MV82BQd2aWV3MV83BQthZnRlck9yTm90MAULYWZ0ZXJPck5vdDEFB2VudGl0eTAFB2VudGl0eTEFBlJhZGlvMQUGUmFkaW8yBQptdWx0aVRhYnMyDw9kAgFkBQltdWx0aVRhYnMPD2QCAWTxwwBRUhg8RDpbUvDvSfu/fmh6Mw==",
			"afterOrNot" : "0",
			"lang" : "zh-TW",
			"view" : "1",
			"term2" : "0",
			"whom1" : "USD",
			"year2" : req.body.year,
			"month2" : req.body.month,
			"day2" : req.body.day
		}
	},function(err,httpResponse,body){
		if(err != "null"){
			$ = cheerio.load(body);
			var timeDom = $("tr.blank").next().children().children().children().children();
			var rowDom = $("table[title=歷史匯率收盤價] > tr");
			var rateResult = {date:" ",data:[]};
			for(var i = 2;i < rowDom.length;i++){
				var rowArray = [];
				var columnDom = rowDom[i].children;
				for(var z = 0;z < 5;z++){
					rowArray.push($(columnDom[z]).text().trim());
				}
				rateResult.data.push(rowArray);
			}
			rateResult.date = $(timeDom).text().trim();
			res.send(rateResult);
		}else{
			console.log(err);
		}
	});
});
