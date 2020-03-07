const express = require('express');
const sql = require('mssql');
const cron = require('node-cron');

sql.on('error', err => {
    console.log(err);
})

const app = express()

const config = {
        user: 'socoma',
        password: 'socoma',
        server: '192.168.1.110\\INTEC', // You can use 'localhost\\instance' to connect to named instance
        database: 'ODS',
        connectionTimeout: 300000,
        requestTimeout: 300000,
}

sql.connect(config).then(
    pool => {
        app.pool = pool;
    });

cron.schedule('0 5 * * *', () => {
    console.log('Rebuild ODS every day');
    return app.pool.request().execute('loadBookInAnalytic')
        .then(result => {
            console.log('Rebuild ODS succeeded');
        })
        .catch(err => {
            console.log('Rebuild ODS failed');
            console.log(err);
        })
});

app.get('/rebuild_ods', function (req, res) {
    return app.pool.request().execute('loadBookInAnalytic')
        .then(result => {
            res.send(result.returnValue);
        })
        .catch(err => {
            res.send(err);
        })
});

app.get('/invoice_number', function (req, res) {
    var company = req.query.company;
    var journal = req.query.journal;
    var numero = '%' + req.query.numero + '%';
    return app.pool.request()
        .input('Company', sql.VarChar(10), company)
        .input('Journal', sql.VarChar(10), journal)
        .input('Number', sql.VarChar(10), numero)
        .query(`SELECT TOP 10
                  u.TBew_Nr AS Number
                  FROM [WinBF1_`+company+`].[dbo].[vBew] u
                  WHERE
                  u.TBew_Nr LIKE @Number AND
                  --u.TBew_DatDok > FromDate AND
                  --u.TBew_DatDok < ToDate AND
                  --"Fournisseur": string,
                  --"Chantier": string,
                  --IncludeConfirmed": boolean,
                  TBew_Peri > '201901' AND
                  TBew_First = 1 AND
                  Tjrl_Cod = @Journal`)
        .then(result => {
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})

app.get('/invoices', function (req, res) {
    var company = req.query.company;
    var journal = req.query.journal;
    var numero = req.query.numero;
    return app.pool.request()
        .input('Company', sql.VarChar(10), company)
        .input('Journal', sql.VarChar(10), journal)
        .input('Number', sql.VarChar(10), numero)
        .query(`SELECT TOP 10
                u.TBew_Nr AS Number,
                u.TBew_DatDok AS Date,
                u.TBew_Peri AS Periode,
                u.TLft_Cod AS Fournisseur,
                (SELECT a.[TAna_Bez3] FROM [WinBF1_`+company+`].[dbo].[TAna] a WHERE a.[TAna_Cod] = (SELECT MAX(s.[TAna_Cod1]) FROM [WinBF1_`+company+`].[dbo].[vBew] s WHERE s.[TJrl_Cod] = u.[TJrl_Cod] AND s.[TBew_Nr] = u.[TBew_Nr])) AS Chantier,
                (SELECT a.[TAna_Bez3] FROM [WinBF1_`+company+`].[dbo].[TAna] a WHERE a.[TAna_Cod] = (SELECT MAX(s.[TAna_Cod2]) FROM [WinBF1_`+company+`].[dbo].[vBew] s WHERE s.[TJrl_Cod] = u.[TJrl_Cod] AND s.[TBew_Nr] = u.[TBew_Nr])) AS Activite,
                u.TBew_Mont AS Total
                FROM [WinBF1_`+company+`].[dbo].[vBew] u
                WHERE
                u.TBew_Nr = @Number AND
                TBew_First = 1 AND
                Tjrl_Cod = @Journal`)
        .then(result => {
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})

app.get('/invoice_pdfs', function (req, res) {
    var company = req.query.company;
    var journal = req.query.journal;
    var numero = req.query.numero;
    return app.pool.request()
        .input('Company', sql.VarChar(10), company)
        .input('Journal', sql.VarChar(10), journal)
        .input('Number', sql.VarChar(10), numero)
        .query(`SELECT TOP 10
                * FROM [ODS].[dbo].[ScanInDoc]
                WHERE
                Company = @Company AND
                Journal = @Journal AND
                Numero = @Number`)
        .then(result => {
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})

app.patch('/invoice_change_chantier', function (req, res) {
    var company = req.query.company;
    var journal = req.query.journal;
    var numero = req.query.numero;
    var chantier_code = req.query.chantier_code;
    return app.pool.request()
        .input('Company', sql.VarChar(10), company)
        .input('Journal', sql.VarChar(10), journal)
        .input('Number', sql.VarChar(10), numero)
        .input('ChantierCode', sql.VarChar(50), chantier_code)
        .query(`UPDATE [WinBF1_`+company+`].[dbo].[vBew] SET TAna_Cod1 = @ChantierCode 
                    WHERE TJrl_Cod = @Journal AND TBew_Nr = @Number AND TAna_Cod1 IS NOT NULL`)
        .then(result => {
          res.send(result);
        }).catch(err => {
          res.send(err);
        })
})

app.get('/dashboard_month_hours_summary', function (req, res) {
    var month = req.query.month;
    return app.pool.request()
        .query(`SELECT * FROM (SELECT TOP 8
                      [Mois]
                      ,SUM([Heures]) AS [Heures]
                      ,SUM([HeuresSupp]) AS [HeuresSupp]
                      ,SUM([Chomage]) AS [Chomage]
                      ,SUM([SansSolde]) AS [SansSolde]
                      ,SUM([Maladie]) AS [Maladie]
                      ,SUM([Conge]) AS [Conge]
                      ,SUM([TotalHours]) AS [TotalHours]
                  FROM [ODS].[dbo].[HeuresOuvrierMonthSum]
                  WHERE [Mois] > FORMAT(DATEADD(MONTH, -8, GETDATE()),'yyyy-MM') AND [Mois] <= FORMAT(GETDATE(),'yyyy-MM')
                  GROUP BY [Mois]
                  ORDER BY [Mois] DESC) p ORDER BY p.Mois ASC`)
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
            .query(`SELECT [ChantierCode],[Chantier]
                          ,[ActiviteCode],[Activite]
                    	  ,SUM([hours]) AS Heures
                      FROM [ODS].[dbo].[HeuresOuvrierProj]
                      WHERE [type] = 'ANW' AND FORMAT(date,'yyyy-MM') = @Month
                      GROUP BY [ChantierCode],[Chantier] ,[ActiviteCode],[Activite]`)
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
            .query(`SELECT [ChantierCode],[Chantier]
                          ,[ActiviteCode],[Activite]
                    	  ,SUM([hours]) AS Heures
                      FROM [ODS].[dbo].[HeuresOuvrierProj]
                      WHERE [type] = 'ANW' AND [employe_code] LIKE @Code AND FORMAT(date,'yyyy-MM') = @Month
                      GROUP BY [ChantierCode],[Chantier] ,[ActiviteCode],[Activite]`)
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

app.get('/year_details', function (req, res) {
    var year = req.query.year;
    var code = req.query.code;
    if(code=='all') {
        return app.pool.request()
            .input('Year', sql.VarChar(10), year)
            .query(`SELECT [ChantierCode],[Chantier]
                          ,[ActiviteCode],[Activite]
                    	  ,SUM([hours]) AS Heures
                      FROM [ODS].[dbo].[HeuresOuvrierProj]
                      WHERE [type] = 'ANW' AND FORMAT(date,'yyyy') = @Year
                      GROUP BY [ChantierCode],[Chantier] ,[ActiviteCode],[Activite]`)
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
            .input('Year', sql.VarChar(10), year)
            .input('Code', sql.VarChar(10), code)
            .query(`SELECT [ChantierCode],[Chantier]
                          ,[ActiviteCode],[Activite]
                    	  ,SUM([hours]) AS Heures
                      FROM [ODS].[dbo].[HeuresOuvrierProj]
                      WHERE [type] = 'ANW' AND [employe_code] LIKE @Code AND FORMAT(date,'yyyy') = @Year
                      GROUP BY [ChantierCode],[Chantier] ,[ActiviteCode],[Activite]`)
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

app.get('/month_employee_details', function (req, res) {
    var month = req.query.month;
    var chantier = req.query.chantier;
    var activite = req.query.activite;
    if (month != 'all') {
        return app.pool.request()
            .input('Month', sql.VarChar(10), month)
            .input('Chantier', sql.VarChar(50), chantier)
            .input('Activite', sql.VarChar(50), activite)
            .query(`SELECT employe_code
                          ,employe
                    	  ,SUM([hours]) AS Heures
                      FROM [ODS].[dbo].[HeuresOuvrierProj]
                      WHERE [type] = 'ANW' AND FORMAT(date,'yyyy-MM') = @Month
                      AND [Chantier] = @Chantier AND [Activite] = @Activite
                      GROUP BY employe_code, employe`)
            .then(result => {
                result.recordset.forEach(line => {
                    line.Heures= Number(line.Heures.toFixed(2))
                });
                res.send(result.recordset);
            }).catch(err => {
                res.send(err);
            })
    } else {
        if(activite != 'null') {
            return app.pool.request()
                .input('Chantier', sql.VarChar(50), chantier)
                .input('Activite', sql.VarChar(50), activite)
                .query(`SELECT employe_code
                              ,employe
                        	  ,SUM([hours]) AS Heures
                          FROM [ODS].[dbo].[HeuresOuvrierProj]
                          WHERE [type] = 'ANW'
                          AND [Chantier] = @Chantier AND [Activite] = @Activite
                          GROUP BY employe_code, employe`)
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
                .input('Chantier', sql.VarChar(50), chantier)
                .input('Activite', sql.VarChar(50), activite)
                .query(`SELECT employe_code
                              ,employe
                        	  ,SUM([hours]) AS Heures
                          FROM [ODS].[dbo].[HeuresOuvrierProj]
                          WHERE [type] = 'ANW'
                          AND [Chantier] = @Chantier AND [Activite] IS NULL
                          GROUP BY employe_code, employe`)
                .then(result => {
                    result.recordset.forEach(line => {
                        line.Heures= Number(line.Heures.toFixed(2))
                    });
                    res.send(result.recordset);
                }).catch(err => {
                    res.send(err);
                })
        }
    }
})

app.get('/employees', function (req, res) {
    return app.pool.request()
        .query(`SELECT employe_code, employe
                  FROM [ODS].[dbo].[OuvriersActifs]
                  ORDER BY employe_code`)
        .then(result => {
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})

app.get('/chantiers', function (req, res) {
    return app.pool.request()
        .query(`SELECT [ChantierCode], [Chantier]
                  FROM [ODS].[dbo].[HeuresOuvrierProj]
                  GROUP BY [ChantierCode],[Chantier]
                  ORDER BY [Chantier]`)
        .then(result => {
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})

app.get('/activites', function (req, res) {
    return app.pool.request()
        .query(`SELECT [ActiviteCode], [Activite]
                  FROM [ODS].[dbo].[HeuresOuvrierProj]
                  GROUP BY [ActiviteCode], [Activite]
                  ORDER BY [ActiviteCode]`)
        .then(result => {
            res.send(result.recordset);
        }).catch(err => {
            res.send(err);
        })
})

app.get('/chantier_activites', function (req, res) {
    var month = req.query.month;
    var chantier = req.query.chantier;
    if (month != 'all') {
      return app.pool.request()
      .input('Month', sql.VarChar(10), month)
      .input('Chantier', sql.VarChar(50), chantier)
      .query(`SELECT [ActiviteCode], [Activite]
              	  ,SUM([hours]) AS Heures
                FROM [ODS].[dbo].[HeuresOuvrierProj]
                WHERE [type] = 'ANW' AND FORMAT(date,'yyyy-MM') = @Month
                AND [Chantier] = @Chantier
                GROUP BY [ActiviteCode], [Activite]`)
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
      .input('Chantier', sql.VarChar(50), chantier)
      .query(`SELECT [ActiviteCode], [Activite]
              	  ,SUM([hours]) AS Heures
                FROM [ODS].[dbo].[HeuresOuvrierProj]
                WHERE [type] = 'ANW'
                AND [Chantier] = @Chantier
                GROUP BY [ActiviteCode], [Activite]`)
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

app.get('/chantier_employes', function (req, res) {
    var month = req.query.month;
    var chantier = req.query.chantier;
    return app.pool.request()
    .input('Chantier', sql.VarChar(50), chantier)
    .query(`SELECT employe_code AS EmployeCode, employe as [Employe]
            	  ,SUM([hours]) AS Heures
              FROM [ODS].[dbo].[HeuresOuvrierProj]
              WHERE [type] = 'ANW' AND [Chantier] = @Chantier
              GROUP BY employe_code, employe`)
    .then(result => {
        result.recordset.forEach(line => {
            line.Heures= Number(line.Heures.toFixed(2))
        });
        res.send(result.recordset);
    }).catch(err => {
        res.send(err);
    })
})

app.patch('/change_chantier', function (req, res) {
    var month = req.query.month;
    var employe_code = req.query.employe_code;
    var activite_code = req.query.activite_code;
    var from_code = req.query.from_code;
    var to_code = req.query.to_code;
    if (month != 'all') {
        return app.pool.request()
        .input('Month', sql.VarChar(50), month)
        .input('EmployeeCode', sql.VarChar(50), employe_code)
        .input('ActivieCode', sql.VarChar(50), activite_code)
        .input('FromCode', sql.VarChar(50), from_code)
        .input('ToCode', sql.VarChar(50), to_code)
        .query(`UPDATE [dbo].[HeuresOuvrierProj]
                    SET ChantierCode = @ToCode
                    WHERE
                        employe_code = @EmployeeCode AND
                        FORMAT(date, 'yyyy-MM') = @Month AND
                        ChantierCode = @FromCode AND
                        ActiviteCode = @ActivieCode`)
        .then(result => {
            res.send(result);
        }).catch(err => {
            res.send(err);
        })
    } else {
        return app.pool.request()
        .input('Month', sql.VarChar(50), month)
        .input('EmployeeCode', sql.VarChar(50), employe_code)
        .input('ActivieCode', sql.VarChar(50), activite_code)
        .input('FromCode', sql.VarChar(50), from_code)
        .input('ToCode', sql.VarChar(50), to_code)
        .query(`UPDATE [dbo].[HeuresOuvrierProj]
                    SET ChantierCode = @ToCode
                    WHERE
                        employe_code = @EmployeeCode AND
                        ChantierCode = @FromCode AND
                        ActiviteCode = @ActivieCode`)
        .then(result => {
            res.send(result);
        }).catch(err => {
            res.send(err);
        })
    }
})

app.patch('/change_activite', function (req, res) {
    var month = req.query.month;
    var employe_code = req.query.employe_code;
    var chantier_code = req.query.chantier_code;
    var from_code = req.query.from_code;
    var to_code = req.query.to_code;
    if (month != 'all') {
      return app.pool.request()
      .input('Month', sql.VarChar(50), month)
      .input('EmployeeCode', sql.VarChar(50), employe_code)
      .input('ChantierCode', sql.VarChar(50), chantier_code)
      .input('FromCode', sql.VarChar(50), from_code)
      .input('ToCode', sql.VarChar(50), to_code)
      .query(`UPDATE [dbo].[HeuresOuvrierProj]
                  SET ActiviteCode = @ToCode
                  WHERE
                      employe_code = @EmployeeCode AND
                      FORMAT(date, 'yyyy-MM') = @Month AND
                      ChantierCode = @ChantierCode AND
                      ActiviteCode = @FromCode`)
      .then(result => {
          res.send(result);
      }).catch(err => {
          res.send(err);
      })
    } else {
      return app.pool.request()
      .input('Month', sql.VarChar(50), month)
      .input('EmployeeCode', sql.VarChar(50), employe_code)
      .input('ChantierCode', sql.VarChar(50), chantier_code)
      .input('FromCode', sql.VarChar(50), from_code)
      .input('ToCode', sql.VarChar(50), to_code)
      .query(`UPDATE [dbo].[HeuresOuvrierProj]
                  SET ActiviteCode = @ToCode
                  WHERE
                      employe_code = @EmployeeCode AND
                      ChantierCode = @ChantierCode AND
                      ActiviteCode = @FromCode`)
      .then(result => {
          res.send(result);
      }).catch(err => {
          res.send(err);
      })
    }
})

app.listen(4201, function () {
  console.log('TimeInDashboard server listening on port 4201!')
})
