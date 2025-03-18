import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

export const registerAdmin = async (req, res) => {
  const { nom, prenom, email, password,numeroDeTelephone} = req.body;

  try {
    // HASH THE PASSWORD

    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(hashedPassword);

    // CREATE A NEW USER AND SAVE TO DB
    const admin = await prisma.admin.create({
      data: {
        email,
        nom,      
        prenom,
        password: hashedPassword,
        numeroDeTelephone,
      },
    });

    console.log(admin);

    res.status(201).json({ message: "admin created successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to create patient!" });
  }
}

export const registerPatient = async (req, res) => {
  const { nom, prenom, email, password,civilite,numeroDeTelephone} = req.body;

  try {
    // HASH THE PASSWORD

    const hashedPassword = await bcrypt.hash(password, 10);

    console.log(hashedPassword);

    // CREATE A NEW USER AND SAVE TO DB
    const newPatient = await prisma.patient.create({
      data: {
        email,
        nom,      
        prenom,
        password: hashedPassword,
        civilite,
        numeroDeTelephone,
        isActive: false,
      },
    });

    console.log(newPatient);

    res.status(201).json({ message: "Your account was create successfully, wait for the ministry to activate it" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to create patient!" });
  }
};

export const registerPersonnnelDeSante = async (req, res) => {
  const { nom, prenom, email, password, dateDeNaissance, numeroIdentificationProfessionnelle,
    specialiteMedical, numeroDeTelephone, type } = req.body;

  try {
    // HASH THE PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate and parse dateDeNaissance
    const [day, month, year] = dateDeNaissance.split("-");
    if (!day || !month || !year) {
      return res.status(400).json({ message: "Invalid date format. Use DD-MM-YYYY." });
    }

    // Create a new Date object (month is 0-indexed)
    const isoDate = new Date(year, month - 1, day);
    
    // Check if the date is valid
    if (isNaN(isoDate.getTime())) {
      return res.status(400).json({ message: "Invalid date provided." });
    }

    // CREATE A NEW USER AND SAVE TO DB
    const newPersonnelDeSante = await prisma.personnnelDeSante.create({
      data: {
        email,
        nom,
        prenom,
        password: hashedPassword,
        dateDeNaissance: isoDate,
        numeroIdentificationProfessionnelle,
        specialiteMedical,
        numeroDeTelephone,
        type,
        isActive: false
      },
    });

    console.log(newPersonnelDeSante);

    res.status(201).json({ message: "PersonnelDeSante created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create PersonnelDeSante!" });
  }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        let user = await prisma.patient.findUnique({
            where: { email },
        });

        // If not found, check PersonnelDeSante
        if (!user) {
            user = await prisma.personnnelDeSante.findUnique({
                where: { email },
            });
        }

        // If still not found, check Admin
        if (!user) {
            user = await prisma.admin.findUnique({
                where: { email },
            });
        }

        // If no user found, return invalid credentials
        if (!user) return res.status(400).json({ message: "Invalid Credentials!" });

        // Check if the password is valid
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(400).json({ message: "Invalid Credentials!" });

        // Check if the user is active (for Patient and PersonnelDeSante)
        if ((user.role === "PATIENT" || user.role === "HEALTH_PERSONNEL") && !user.isActive) {
            return res.status(403).json({ message: "Account is inactive. Please contact an admin." });
        }

        const age = 1000 * 60 * 60 * 24 * 7; // Token expiration time

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role, // Include user's role in JWT payload for authorization checks later
            },
            process.env.JWT_SECRET_KEY,
            { expiresIn: age }
        );

        const { password: userPassword, ...userInfo } = user;

        res.cookie("token", token, {
            httpOnly: true,
            maxAge: age,
        })
        .status(200)
        .json(userInfo);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to login!" });
    }
};



export const updateUserActivation = async (req, res) => {
    const { email } = req.params; // Get userId from request parameters

    // Verify the JWT token and extract user information (including role)
    const token = req.cookies.token; // Assuming you're using cookies for JWT storage

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        
        // Check if the user is an admin based on their role
        if (decoded.role !== "ADMIN") {
            return res.status(403).json({ message: "Forbidden: Only admins can perform this action." });
        }

        // Try to find the user in each model
        let updatedUser;

        // Check if the user is a Patient
        updatedUser = await prisma.patient.findUnique({
            where: { email},
        });

        if (updatedUser) {
            // Update Patient's activation status
            updatedUser = await prisma.patient.update({
                where: { email },
                data: { isActive: true }, // Set to true or false based on your logic
            });
            return res.status(200).json(updatedUser);
        }

        // Check if the user is PersonnelDeSante
        updatedUser = await prisma.personnnelDeSante.findUnique({
            where: { email },
        });

        if (updatedUser) {
            // Update PersonnelDeSante's activation status
            updatedUser = await prisma.personnnelDeSante.update({
                where: { email },
                data: { isActive: true }, // Set to true or false based on your logic
            });
            return res.status(200).json(updatedUser);
        }

        return res.status(404).json({ message: "User not found." }); // User not found in either model

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update user activation status." });
    }
};



export const logout = (req, res) => {
  res.clearCookie("token").status(200).json({ message: "Logout Successful" });
};

export const getUsersforAdmin = async (req, res) => {
  try {
    const users = await prisma.personnnelDeSante.findMany();
    let usersForAdmin = await prisma.patient.findMany();
    usersForAdmin = [...users,...usersForAdmin]
    res.status(200).json(usersForAdmin);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get users!" });
  }
};
