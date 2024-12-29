import {pool}  from '../config/dbConfig.js';
import { generateToken, hashPassword, comparePassword } from '../config/encrypt-decrypt.js';

const signupUser = async (req, res) => {
    try {
        // Signup logic here
        const {firstName, email, password} = req.body;
        if(!(firstName || email || password)) {
            res.status(400).json({ 
                status:false,
                message: "Please provide all required fields" 
            });
        }
        const existingUser = await pool.query({
            text: 'SELECT EXISTS(SELECT * FROM tbluser WHERE email = $1)',
            values: [email]
        })
        if(existingUser.rows[0].exists) {
            res.status(400).json({ 
                status:false,
                message: "User with this email already exists" 
            });

        }
        // Save user to database
        //hash the password before storing it in the database 
        const hashedPassword = await hashPassword(password);

        const user = await pool.query({
            text: 'INSERT INTO tbluser(firstname, email, password) VALUES($1, $2, $3) RETURNING *',
            values: [firstName, email, hashedPassword]
        })

        user.rows[0].password = undefined; // this is to ensure that the password is not returned in the response




        res.status(200).json({ 
            status:true,
            message: "Signup successful",
            user: user.rows[0]
        });
    } catch (error) {
        console.log(error);
        res.status(400).json({ 
            status:false,
            error: error.message ,
            message: "Signup failed, please try again"
        });
    }
};

const signinUser = async (req, res) => {
    try {
        const {email, password} = req.body;

        if(!(email || password)) {
            res.status(400).json({ 
                status:false,
                message: "Please provide all required fields" 
            });
        }
        const user = await pool.query({
            text: 'SELECT * FROM tbluser WHERE email = $1',
            values: [email]
        });
        if(!user.rows[0]) {
            res.status(400).json({ 
                status:false,
                message: "User with this email does not exist" 
            });
        }
        // Verify password
        // Compare the password with the hashed password in the database
        const match = await comparePassword(password, user.rows[0].password);
        if(!match) {
            res.status(400).json({ 
                status:false,
                message: "Invalid password, please try again" 
            });
        }
        console.log(user.rows[0].id);
        const token = generateToken( user.rows[0].id);
        user.rows[0].token = token;

        user.rows[0].password = undefined; // this is to ensure that the password is not returned in the response
        // Signin logic here
        res.status(200).json({
            status:true,
            message: "Signin successful",
            user: user.rows[0],
            token

        });
    } catch (error) {
        console.log(error);
        res.status(400).json({ 
            status:false,

            error: error.message
        });
    }
};

export { signupUser, signinUser };