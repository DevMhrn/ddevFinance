import { pool } from "../config/dbConfig.js";
import { hashPassword, comparePassword } from "../config/encrypt-decrypt.js";

export const getUser = async (req, res) => {
    try {
        const {userId} = req.body.user;
        //const { id } = req.params; // didn't work because the id is not passed in the request
        const user = await pool.query({
            text: 'SELECT * FROM tbluser WHERE id = $1',
            values: [userId]
        });
        console.log('User:', user.rows);
        if(user.rows.length === 0) {
            return res.status(404).json({ 
                status: false,
                message: "User not found" 
            });
        }
        return res.status(200).json({ 
            status: true,
            user: user.rows[0]
        });
        
    } catch (error) {
        console.log(error);
        return res.status(400).json({ 
            status: false,
            error: error.message
        });
    }
}

export const updateUser = async (req, res) => {
    try {

        const { id } = req.params;
        console.log('user:', req.body);

        const { userId } = req.body.user || {};
        const { firstname, lastname, email, contact, currency, country } = req.body;

        // Validate lengths before querying
        if (currency.length > 3) {
            return res.status(400).json({ 
                status: false,
                message: "Currency code too long" 
            });
        }

        if (country.length !== 2) {
            return res.status(400).json({ 
                status: false,
                message: "Country code must be 2 characters long" 
            });
        }
        const user = await pool.query({
            text: 'SELECT * FROM tbluser WHERE id = $1',
            values: [userId]
        });
        if(user.rows.length === 0) {
            return res.status(404).json({ 
                status: false,
                message: "User not found" 
            });
        }

        const updatedUser = await pool.query({
            text: 'UPDATE tbluser SET firstname = $1, lastname = $2, email = $3, contact = $4, currency = $5, country = $6 WHERE id = $7 RETURNING *',
            values: [firstname, lastname, email, contact, currency, country, userId]
        });
        
        updatedUser.rows[0].password = undefined;
        res.status(200).json({ 
            status:true,
            message: "User updated successfully",
            user: updatedUser.rows[0] 
        });
        
    } catch (error) {
        console.log(error);
        res.status(400).json({ 
            status:false,
            error: error.message
        });
        
    }
}
export const changePasswordOfUser = async (req, res) => {
    try {
        const {userId} = req.body.user;
        const { id } = req.params;
        const {currentPassword, newPassword, confirmPassword} = req.body;
        const user = await pool.query({
            text: 'SELECT * FROM tbluser WHERE id = $1',
            values: [userId]
        })
        if(user.rows.length === 0) {
            return res.status(404).json({ 
                status: false,
                message: "User not found" 
            });
        }
        if(newPassword !== confirmPassword) {
            return res.status(400).json({ 
                status: false,
                message: "Passwords do not match, enter the same password in both fields" 
            });
        }
        const match = await comparePassword(currentPassword, user.rows[0]?.password);
        if(!match) {
            return res.status(400).json({ 
                status: false,
                message: "Invalid password, please try again" 
            });
        }
        const hashedPassword = await hashPassword(newPassword);
        await pool.query({
            text: 'UPDATE tbluser SET password = $1 WHERE id = $2',
            values: [hashedPassword, userId]
        });
        res.status(200).json({ 
            status:true,
            message: "Password updated successfully" 
        });


        
    } catch (error) {
        console.log(error);
        res.status(400).json({ 
            status:false,
            error: error.message
        });
        
    }
}
