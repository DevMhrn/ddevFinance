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
        const { userId } = req.body.user;
        const { firstname, lastname, email, contact, currency, country } = req.body;

        // Validate currency and country
        if (currency && currency.length > 3) {
            return res.status(400).json({ 
                status: false,
                message: "Currency code too long" 
            });
        }

        if (country && country.length !== 2) {
            return res.status(400).json({ 
                status: false,
                message: "Country code must be 2 characters long" 
            });
        }

        // Check if email exists but exclude current user
        if (email) {
            const existingEmail = await pool.query({
                text: 'SELECT * FROM tbluser WHERE email = $1 AND id != $2',
                values: [email, userId]
            });

            if (existingEmail.rows.length > 0) {
                return res.status(400).json({ 
                    status: false,
                    message: "Email already exists" 
                });
            }
        }

        // Only update fields that are provided
        const updates = [];
        const values = [];
        let valueCount = 1;

        if (firstname) { updates.push(`firstname = $${valueCount}`); values.push(firstname); valueCount++; }
        if (lastname) { updates.push(`lastname = $${valueCount}`); values.push(lastname); valueCount++; }
        if (email) { updates.push(`email = $${valueCount}`); values.push(email); valueCount++; }
        if (contact) { updates.push(`contact = $${valueCount}`); values.push(contact); valueCount++; }
        if (currency) { updates.push(`currency = $${valueCount}`); values.push(currency); valueCount++; }
        if (country) { updates.push(`country = $${valueCount}`); values.push(country); valueCount++; }

        values.push(userId);

        const updateQuery = {
            text: `UPDATE tbluser SET ${updates.join(', ')} WHERE id = $${valueCount} RETURNING *`,
            values: values
        };

        const updatedUser = await pool.query(updateQuery);
        
        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ 
                status: false,
                message: "User not found" 
            });
        }

        // Remove password from response
        const userResponse = { ...updatedUser.rows[0] };
        delete userResponse.password;

        return res.status(200).json({ 
            status: true,
            message: "User updated successfully",
            user: userResponse
        });
        
    } catch (error) {
        console.log(error);
        return res.status(400).json({ 
            status: false,
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
