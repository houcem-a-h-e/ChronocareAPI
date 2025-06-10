import express from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from 'uuid'; // Add this import
import {
  deleteUser,
  getUser,
  updateUser,
  savePost,
  profilePosts,
  getNotificationNumber,
  updateUserProfile,
  createRendezVous,
  getPatientRendezVous,
  createDossier,
  getPatientDossiers,
  createConsultation,
  getDossierConsultations,
  getPatientById,
  getRendezVousByPersonnel,
  updateRendezVousStatut,
  updatePatientProfile,
  addKidToPatient,
  getPatientRendezVousById,
  deletePatientDossier
} from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import  prisma  from "../lib/prisma.js"; // Add this import for the search endpoint

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

const consultationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/consultations/");
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  },
});

const uploadConsultationFile = multer({
  storage: consultationStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];
    allowedTypes.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Type de fichier invalide. Seuls PDF, Word et images sont autorisés.'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})
// Dossier storage configuration
const dossierStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/dossiers/");
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname)); // Now uuidv4 is available
  }
});

const uploadDossierFile = multer({ 
  storage: dossierStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];
    allowedTypes.includes(file.mimetype) 
      ? cb(null, true) 
      : cb(new Error('Invalid file type. Only PDF, Word docs, and images are allowed.'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Existing routes
router.put("/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);
router.post("/save", verifyToken, savePost);
router.get("/profilePosts", verifyToken, profilePosts);
router.get("/notification", verifyToken, getNotificationNumber);

router.patch(
  "/users/:id/profile",
  verifyToken,
  (req, res, next) => {
    upload.single("profilePicture")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ 
          message: "File upload failed",
          error: err.message 
        });
      }
      next();
    });
  },
  updateUserProfile
);

// Rendez-vous routes
router.post("/rendezvous", verifyToken, createRendezVous);
router.get("/getRendezvousByPersonnelEmail", verifyToken, getRendezVousByPersonnel)
router.get("/rendezvous/patient/:patientId", verifyToken, getPatientRendezVous);
router.patch("/rendezvous/:id/statut", verifyToken, updateRendezVousStatut)
// Dossier routes
router.get("/dossiers/patient/:email", verifyToken, getPatientDossiers);
router.post(
  "/dossiers",
  verifyToken,
  uploadDossierFile.single('medicalDocument'),
  createDossier
);

// Patient routes
router.get("/patients/search", verifyToken, async (req, res) => {
  try {
    const { term } = req.query;
    
    if (!term || term.trim().length < 2) {
      return res.status(200).json([]);
    }

    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { nom: { contains: term, mode: 'insensitive' } },
          { prenom: { contains: term, mode: 'insensitive' } },
          { numeroDeTelephone: { contains: term } },
          { email: { contains: term, mode: 'insensitive' } }
        ]
      },
      take: 5,
      select: {
        id: true,
        nom: true,
        prenom: true,
        numeroDeTelephone: true,
        email: true
      }
    });

    res.status(200).json(patients);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
});

router.get("/patients/:id", verifyToken, getPatientById);
router.get("/rendezvous/patient/:id", verifyToken, getPatientRendezVousById);

router.delete("/dossiers/:id", verifyToken, deletePatientDossier);
// Consultation routes
router.post(
  "/consultations",
  verifyToken,
  uploadConsultationFile.single("medicalDocument"), // nom du champ fichier attendu dans le formulaire
  createConsultation
)
router.get("/consultations/dossier/:dossierId", verifyToken, getDossierConsultations);
router.patch(
  "/patient/:id/profile",
  verifyToken,
  (req, res, next) => {
    upload.single("avatar")(req, res, (err) => { // "avatar" doit correspondre au nom du champ fichier envoyé par le frontend
      if (err) {
        return res.status(400).json({ message: "File upload failed", error: err.message });
      }
      next();
    });
  },
  updatePatientProfile
)

router.post("/patients/:id/kids", verifyToken, addKidToPatient)
export default router;