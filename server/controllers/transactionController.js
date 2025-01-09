import { pool } from "../config/dbConfig.js";

const getMonthName = (index) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[index];
};

export const getTransactions = async (req, res) => {
    try {
        const { userId } = req.body.user;
        const { df, dt, s } = req.query;

        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const startDate = new Date(df || sevenDaysAgo);
        const endDate = new Date(dt || today);

        const transactions = await pool.query({
            text: `SELECT * FROM tbltransaction 
                   WHERE user_id = $1 
                   AND createdat BETWEEN $2 AND $3 
                   AND (description ILIKE '%' || $4 || '%' 
                   OR status ILIKE '%' || $4 || '%' 
                   OR source ILIKE '%' || $4 || '%') 
                   ORDER BY id DESC`,
            values: [userId, startDate, endDate, s || '']
        });

        return res.status(200).json({
            status: true,
            transactions: transactions.rows
        });
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            status: false,
            error: error.message
        });
    }
};

export const getDashboardInformation = async (req, res) => {
    try {
        const { userId } = req.body.user;
        
        // Get transaction totals
        const totalsResult = await pool.query({
            text: `SELECT type, SUM(amount) as total 
                   FROM tbltransaction 
                   WHERE user_id = $1 
                   GROUP BY type`,
            values: [userId]
        });

        let totalIncome = 0;
        let totalExpense = 0;

        totalsResult.rows.forEach(row => {
            if (row.type === 'income') {
                totalIncome = parseFloat(row.total) || 0;
            } else {
                totalExpense = parseFloat(row.total) || 0;
            }
        });

        // Get monthly data for current year
        const year = new Date().getFullYear();
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31, 23, 59, 59);

        const result = await pool.query({
            text: `SELECT 
                    EXTRACT(MONTH FROM createdat) AS month,
                    type,
                    SUM(amount) AS totalamount 
                   FROM tbltransaction 
                   WHERE user_id = $1 
                   AND createdat BETWEEN $2 AND $3 
                   GROUP BY EXTRACT(MONTH FROM createdat), type`,
            values: [userId, startDate, endDate]
        });

        // Format chart data using my approach
        const data = new Array(12).fill().map((_, index) => {
            const monthData = result.rows.filter(
                (item) => parseInt(item.month) === index + 1
            );
            const income = monthData.find((item) => item.type === "income")?.totalamount || 0;
            const expense = monthData.find((item) => item.type === "expense")?.totalamount || 0;

            return {
                label: getMonthName(index),
                income,
                expense,
            };
        });

        // Get recent data
        const [recentTransactions, recentAccounts] = await Promise.all([
            pool.query({
                text: `SELECT * FROM tbltransaction 
                       WHERE user_id = $1 
                       ORDER BY createdat DESC LIMIT 5`,
                values: [userId]
            }),
            pool.query({
                text: `SELECT * FROM tblaccount 
                       WHERE user_id = $1 
                       ORDER BY createdat DESC LIMIT 4`,
                values: [userId]
            })
        ]);

        return res.status(200).json({
            status: true,
            dashboard: {
                availableBalance: totalIncome - totalExpense,
                totalIncome,
                totalExpense,
                chartData: data,
                lastTransactions: recentTransactions.rows,
                lastAccounts: recentAccounts.rows
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            status: false,
            error: error.message
        });
    }
};

export const addTransaction = async (req, res) => {
    // this addtransaction function is used to add a transaction to the database
    try {
        const { userId } = req.body.user;
        const { account_id } = req.params;
        const { description, source, amount } = req.body;

        if (!description || !source || !amount) {
            return res.status(400).json({
                status: false,
                message: "Please provide all required fields"
            });
        }

        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                status: false,
                message: "Invalid amount"
            });
        }

        const accountResult = await pool.query({
            text: 'SELECT * FROM tblaccount WHERE id = $1 AND user_id = $2',
            values: [account_id, userId]
        });

        if (accountResult.rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: "Account not found or unauthorized"
            });
        }

        const account = accountResult.rows[0];
        if (account.account_balance < numericAmount) {
            return res.status(400).json({
                status: false,
                message: "Transaction failed due to Insufficient balance"
            });
        }

        // Begin transaction
        await pool.query('BEGIN');
        try {
            await pool.query({
                text: `UPDATE tblaccount 
                       SET account_balance = account_balance - $1,
                           updatedat = CURRENT_TIMESTAMP 
                       WHERE id = $2`,
                values: [numericAmount, account_id]
            });

            await pool.query({
                text: `INSERT INTO tbltransaction 
                       (user_id, description, type, status, amount, source)
                       VALUES ($1, $2, $3, $4, $5, $6)`,
                values: [userId, description, 'expense', 'Completed', numericAmount, source]
            });

            await pool.query('COMMIT');

            return res.status(201).json({
                status: true,
                message: "Transaction completed successfully"
            });
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            status: false,
            error: error.message
        });
    }
};

export const transferMoneyToAccount = async (req, res) => {
    try {
        const { userId } = req.body.user;
        const { from_account, to_account, amount } = req.body;

        if (!from_account || !to_account || !amount) {
            return res.status(400).json({
                status: false,
                message: "Please provide all required fields!!"
            });
        }

        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({
                status: false,
                message: "Invalid amount"
            });
        }

        // Begin transaction
        await pool.query('BEGIN');
        try {
            const [fromAccountResult, toAccountResult] = await Promise.all([
                pool.query({
                    text: 'SELECT * FROM tblaccount WHERE id = $1 AND user_id = $2',
                    values: [from_account, userId]
                }),
                pool.query({
                    text: 'SELECT * FROM tblaccount WHERE id = $1 AND user_id = $2',
                    values: [to_account, userId]
                })
            ]);

            if (fromAccountResult.rows.length === 0 || toAccountResult.rows.length === 0) {
                await pool.query('ROLLBACK');
                return res.status(404).json({
                    status: false,
                    message: "One or both accounts not found or unauthorized"
                });
            }

            const fromAccount = fromAccountResult.rows[0];
            const toAccount = toAccountResult.rows[0];

            if (fromAccount.account_balance < numericAmount) {
                await pool.query('ROLLBACK');
                return res.status(400).json({
                    status: false,
                    message: "Insufficient balance in source account"
                });
            }

            // Update both accounts
            await Promise.all([
                pool.query({
                    text: `UPDATE tblaccount 
                           SET account_balance = account_balance - $1,
                               updatedat = CURRENT_TIMESTAMP 
                           WHERE id = $2`,
                    values: [numericAmount, from_account]
                }),
                pool.query({
                    text: `UPDATE tblaccount 
                           SET account_balance = account_balance + $1,
                               updatedat = CURRENT_TIMESTAMP 
                           WHERE id = $2`,
                    values: [numericAmount, to_account]
                })
            ]);

            // Record both transactions
            await Promise.all([
                pool.query({
                    text: `INSERT INTO tbltransaction 
                           (user_id, description, type, status, amount, source)
                           VALUES ($1, $2, $3, $4, $5, $6)`,
                    values: [
                        userId,
                        `Transfer to ${toAccount.account_name}`,
                        'expense',
                        'Completed',
                        numericAmount,
                        fromAccount.account_name
                    ]
                }),
                pool.query({
                    text: `INSERT INTO tbltransaction 
                           (user_id, description, type, status, amount, source)
                           VALUES ($1, $2, $3, $4, $5, $6)`,
                    values: [
                        userId,
                        `Transfer from ${fromAccount.account_name}`,
                        'income',
                        'Completed',
                        numericAmount,
                        toAccount.account_name
                    ]
                })
            ]);

            await pool.query('COMMIT');

            return res.status(201).json({
                status: true,
                message: "Transfer completed successfully"
            });
        } catch (error) {
            await pool.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.log(error);
        return res.status(400).json({
            status: false,
            error: error.message
        });
    }
};
