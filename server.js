const express = require('express');
const cors = require('cors');
const sql = require('mssql');

sql.on('error', err => {
    console.log(err);
})

const app = express()

app.use(cors())

const config = {
        user: 'socoma',
        password: 'socoma',
        server: '192.168.1.110\\INTEC', // You can use 'localhost\\instance' to connect to named instance
        database: 'ODS',
}

sql.connect(config).then(
    pool => {
        app.pool = pool;
    });
    
app.get('/dashboard_month_hours_summary', function (req, res) {
    var month = req.query.month;
    return app.pool.request()
        .query(`SELECT TOP 10
                      [Mois]
                      ,SUM([Heures]) AS [Heures]
                      ,SUM([HeuresSupp]) AS [HeuresSupp]
                      ,SUM([Chomage]) AS [Chomage]
                      ,SUM([SansSolde]) AS [SansSolde]
                      ,SUM([Maladie]) AS [Maladie]
                      ,SUM([Conge]) AS [Conge]
                      ,SUM([TotalHours]) AS [TotalHours]
                  FROM [ODS].[dbo].[HeuresOuvrierMonthSum]
                  WHERE [Mois] < ('2018-09')
                  GROUP BY [Mois]
                  ORDER BY [Mois] ASC`)
        .then(result => {
            result.recordset.forEach(line => {
                line.Heures= Number(line.Heures.toFixed(2))
                line.HeuresSupp = Number(line.HeuresSupp.toFixed(2))
                line.Chomage =  Number(line.Chomage.toFixed(2))
                line.SansSolde =  Number(line.SansSolde.toFixed(2))
                line.Maladie =  Number(line.Maladie.toFixed(2))
                line.Conge =  Number(line.Conge.toFixed(2))
                line.TotalHours =  Number(line.TotalHours.toFixed(2))
            });
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})
    
app.get('/month_summary', function (req, res) {
    var month = req.query.month;
    return app.pool.request()
        .input('Month', sql.VarChar(10), month)
        .query(`SELECT * 
                    FROM [ODS].[dbo].[HeuresOuvrierMonthSum]
                    WHERE Mois = @Month`)
        .then(result => {
            result.recordset.forEach(line => {
                line.Heures= Number(line.Heures.toFixed(2))
                line.HeuresSupp = Number(line.HeuresSupp.toFixed(2))
                line.Chomage =  Number(line.Chomage.toFixed(2))
                line.SansSolde =  Number(line.SansSolde.toFixed(2))
                line.Maladie =  Number(line.Maladie.toFixed(2))
                line.Conge =  Number(line.Conge.toFixed(2))
                line.TotalHours =  Number(line.TotalHours.toFixed(2))
            });
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})

app.get('/month_details', function (req, res) {
    var month = req.query.month;
    var code = req.query.code;
    if(code=='all') {
        return app.pool.request()
            .input('Month', sql.VarChar(10), month)
            .query(`SELECT [Chantier]
                          ,[Activite]
                    	  ,SUM([hours]) AS Heures
                      FROM [ODS].[dbo].[HeuresOuvrierProj]
                      WHERE [type] = 'ANW' AND FORMAT(date,'yyyy-MM') = @Month
                      GROUP BY [Chantier] ,[Activite]`)
            .then(result => {
                result.recordset.forEach(line => {
                    line.Heures= Number(line.Heures.toFixed(2))
                });
                res.send(result.recordset);
            }).catch(err => {
                res.send(err);
            })
    } else {
        return app.pool.request()
            .input('Month', sql.VarChar(10), month)
            .input('Code', sql.VarChar(10), code)
            .query(`SELECT [Chantier]
                          ,[Activite]
                    	  ,SUM([hours]) AS Heures
                      FROM [ODS].[dbo].[HeuresOuvrierProj]
                      WHERE [type] = 'ANW' AND [employe_code] LIKE @Code AND FORMAT(date,'yyyy-MM') = @Month
                      GROUP BY [Chantier] ,[Activite]`)
            .then(result => {
                result.recordset.forEach(line => {
                    line.Heures= Number(line.Heures.toFixed(2))
                });
                res.send(result.recordset);
            }).catch(err => {
                res.send(err);
            })
    }
})

app.get('/employees', function (req, res) {
    return app.pool.request()
        .query(`SELECT employe_code, employe
                  FROM [ODS].[dbo].[HeuresOuvrierProj]
                  GROUP BY employe_code, employe`)
        .then(result => {
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})

app.listen(4201, function () {
  console.log('TimeInDashboard server listening on port 4201!')
})
