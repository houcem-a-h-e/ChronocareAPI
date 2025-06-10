import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import { pipeline, env , Tensor} from '@xenova/transformers'; // Added env import
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid'
import { createRequire } from 'node:module';
export const updateUserProfile = async (req, res) => {
  try {
    const dateDeNaissance = new Date(req.body.dateDeNaissance);
    if (isNaN(dateDeNaissance)) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    const { role } = req.user;
    const { id } = req.params;
    // Determine which model to use based on user role
    const modelMap = {
      'HEALTH_PERSONNEL': prisma.personnnelDeSante,
      'PATIENT': prisma.patient,
      'ADMIN': prisma.admin
    };
    const userModel = modelMap[req.user.role]; // Get role from verified token
    // Handle form data fields from multipart/form-data
    const dataToUpdate = {
      genre: req.body.genre,
      dateDeNaissance: new Date(req.body.dateDeNaissance), // Convert to Date
      numeroDeTelephone: req.body.numeroDeTelephone,
      email: req.body.email,
      specialiteMedical: req.body.specialiteMedical,
    };

    if (req.file) {
      dataToUpdate.avatar = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await  userModel.update({
      where: { id: req.params.id },
      data: dataToUpdate,
    });

    const { password, ...rest } = updatedUser;
    res.status(200).json(rest);
  } catch (err) {
    console.error("Detailed error:", err);
    res.status(500).json({ 
      message: "Failed to update profile",
      error: err.message 
    });
  }
};
export const getUser = async (req, res) => {
  const id = req.params.id;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get user!" });
  }
};

export const updateUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;
  const { password, avatar, ...inputs } = req.body;

  if (id !== tokenUserId) {
    return res.status(403).json({ message: "Not Authorized!" });
  }

  let updatedPassword = null;
  try {
    if (password) {
      updatedPassword = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...inputs,
        ...(updatedPassword && { password: updatedPassword }),
        ...(avatar && { avatar }),
      },
    });

    const { password: userPassword, ...rest } = updatedUser;

    res.status(200).json(rest);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update users!" });
  }
};

export const deleteUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  if (id !== tokenUserId) {
    return res.status(403).json({ message: "Not Authorized!" });
  }

  try {
    await prisma.user.delete({
      where: { id },
    });
    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to delete users!" });
  }
};

export const savePost = async (req, res) => {
  const postId = req.body.postId;
  const tokenUserId = req.userId;

  try {
    const savedPost = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId: tokenUserId,
          postId,
        },
      },
    });

    if (savedPost) {
      await prisma.savedPost.delete({
        where: {
          id: savedPost.id,
        },
      });
      res.status(200).json({ message: "Post removed from saved list" });
    } else {
      await prisma.savedPost.create({
        data: {
          userId: tokenUserId,
          postId,
        },
      });
      res.status(200).json({ message: "Post saved" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to delete users!" });
  }
};

export const profilePosts = async (req, res) => {
  const tokenUserId = req.userId;
  try {
    const userPosts = await prisma.post.findMany({
      where: { userId: tokenUserId },
    });
    const saved = await prisma.savedPost.findMany({
      where: { userId: tokenUserId },
      include: {
        post: true,
      },
    });

    const savedPosts = saved.map((item) => item.post);
    res.status(200).json({ userPosts, savedPosts });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get profile posts!" });
  }
};

export const getNotificationNumber = async (req, res) => {
  const tokenUserId = req.userId;
  try {
    const number = await prisma.chat.count({
      where: {
        userIDs: {
          hasSome: [tokenUserId],
        },
        NOT: {
          seenBy: {
            hasSome: [tokenUserId],
          },
        },
      },
    });
    res.status(200).json(number);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get profile posts!" });
  }
};
export const createRendezVous = async (req, res) => {
  try {
    const { patientEmail, dateHeure, remarks, typeDeVisite } = req.body;
    const personnelId = req.user.id;

    if (!patientEmail || !dateHeure || !remarks || !typeDeVisite) {
      return res.status(400).json({ message: "Champs obligatoires manquants" });
    }

    // Récupérer l'email du personnel via son id
    const personnel = await prisma.personnnelDeSante.findUnique({
      where: { id: personnelId },
      select: { email: true },
    });

    if (!personnel) {
      return res.status(404).json({ message: "Personnel non trouvé" });
    }

    const personnelEmail = personnel.email;

    // Vérifier conflit de créneau
    const conflictingAppointment = await prisma.rendezVous.findFirst({
      where: {
        personnelEmail,
        dateHeure: new Date(dateHeure),
        statut: { in: ["PLANNED", "CONFIRMED"] },
      },
    });

    if (conflictingAppointment) {
      return res.status(400).json({
        message: "Créneau déjà réservé",
        conflictingAppointment,
      });
    }

    // Créer le rendez-vous
    const newRendezVous = await prisma.rendezVous.create({
      data: {
        dateHeure: new Date(dateHeure),
        statut: "PLANNED",
        remarks,
        typeDeVisite,
        patientEmail,
        personnelEmail,
      },
      include: {
        patient: {
          select: {
            nom: true,
            prenom: true,
            numeroDeTelephone: true,
          },
        },
      },
    });

    res.status(201).json(newRendezVous);
  } catch (error) {
    console.error("Error creating rendezvous:", error);
    res.status(500).json({ message: "Failed to create appointment" });
  }
};



export const getPatientRendezVous = async (req, res) => {
  try {
    const { patientId } = req.params;

    // 1. Récupérer le patient pour obtenir son email
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { email: true },
    });

    if (!patient) {
      return res.status(404).json({ message: "Patient non trouvé" });
    }

    // 2. Récupérer les rendez-vous via l'email du patient
    const rendezVous = await prisma.rendezVous.findMany({
      where: { patientEmail: patient.email },
      orderBy: { dateHeure: "asc" },
      include: {
        personnel: {
          select: {
            nom: true,
            prenom: true,
            specialiteMedical: true,
          },
        },
      },
    });

    res.status(200).json(rendezVous);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Failed to get appointments" });
  }
};
;



// ====================== NEW DOSSIER CONTROLLERS ======================
export const createDossier = async (req, res) => {
  try {
    const {
      dossierNumber,
      fullName,
      gender,
      birthDate,
      phone,
      email,
      address,
      bloodGroup,
      chronicDisease,
      diseaseDetails,
      weight,
      height,
      patientId
    } = req.body;

    // Validate required fields
    const requiredFields = {
      dossierNumber: "Dossier number is required",
      fullName: "Full name is required",
      gender: "Gender is required",
      birthDate: "Birth date is required",
      phone: "Phone number is required",
      patientId: "Patient ID is required",
      email: "Email is required"
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([field]) => !req.body[field])
      .map(([_, message]) => message);

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: "Validation failed",
        errors: missingFields 
      });
    }

    const personnelId = req.user.id; // From auth middleware

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'dossiers');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Handle file upload if exists
    let medicalDocumentPath = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const filename = `${uuidv4()}${ext}`;
      medicalDocumentPath = `/uploads/dossiers/${filename}`;
      
      const destination = path.join(uploadDir, filename);
      
      // Move the file to permanent location
      await fs.promises.rename(req.file.path, destination);
    }

    const newDossier = await prisma.patientDossier.create({
      data: {
        dossierNumber,
        fullName,
        gender,
        birthDate: new Date(birthDate),
        phone,
        email: email,
        address: address || null,
        bloodGroup: bloodGroup || null,
        chronicDisease: chronicDisease === 'true',
        diseaseDetails: diseaseDetails || null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        medicalDocument: medicalDocumentPath,
        patient: { connect: { id: patientId } },
        personnel: { connect: { id: personnelId } }
      },
      include: {
        patient: {
          select: {
            id: true,
            nom: true,
            prenom: true
          }
        }
      }
    });

    res.status(201).json(newDossier);
  } catch (error) {
    console.error('Error creating dossier:', error);
    
    // Clean up uploaded file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (err) {
        console.error('Error cleaning up file:', err);
      }
    }

    res.status(500).json({ 
      message: 'Failed to create medical dossier',
      error: error.message 
    });
  }
};

export const getPatientDossiers = async (req, res) => {
  try {
    const { email } = req.params;
    const dossiers = await prisma.patientDossier.findMany({
      where: { email },
      include: {
        consultations: {
          orderBy: { date: 'desc' }
        }
      }
    });
    res.status(200).json(dossiers);
  } catch (error) {
    console.error('Error fetching dossiers:', error);
    res.status(500).json({ message: 'Failed to get medical dossiers' });
  }
};

export const deletePatientDossier = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // First get the dossier to verify ownership
    const dossier = await prisma.patientDossier.findUnique({
      where: { id },
      include: {
        patient: true,
        consultations: true // Include consultations to check if they exist
      }
    });

    if (!dossier) {
      return res.status(404).json({ message: 'Dossier not found' });
    }

    // Verify the user is either the patient owner or health personnel
    if (userRole === 'PATIENT' && dossier.patient.id !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this dossier' });
    }

    // First delete all related consultations
    if (dossier.consultations.length > 0) {
      await prisma.consultation.deleteMany({
        where: { dossierId: id }
      });
    }

    // Then delete the dossier
    await prisma.patientDossier.delete({
      where: { id }
    });

    res.status(200).json({ message: 'Dossier deleted successfully' });
  } catch (error) {
    console.error('Error deleting dossier:', error);
    res.status(500).json({ 
      message: 'Failed to delete dossier',
      error: error.message 
    });
  }
};

// ====================== NEW CONSULTATION CONTROLLERS ======================
export const createConsultation = async (req, res) => {
  try {
    const {
      motifConsultation,
      notes,
      prescription,
      doctorEmail,
      patientEmail,
      AntecedentsMedicaux,
      symptomesObservees,
      ExamenComplementairesDemandes,
      prochainRdv,
      Diagnostic,
    } = req.body;

    // 1. Récupérer le dernier dossier du patient
    const lastDossier = await prisma.patientDossier.findFirst({
      where: { patientEmail },
      orderBy: { createdAt: "desc" },
    });

    if (!lastDossier) {
      return res.status(404).json({ message: "Aucun dossier trouvé pour ce patient" });
    }

    const dossierId = lastDossier.id;

    // 2. Récupérer le personnel via l'id dans req.user
    const personnel = await prisma.personnnelDeSante.findUnique({
      where: { id: req.user.id },
    });

    if (!personnel) {
      return res.status(404).json({ message: "Personnel non trouvé" });
    }

    const personnelEmail = personnel.email;

    // 3. Validation minimale
    if (!motifConsultation || !doctorEmail || !patientEmail) {
      return res.status(400).json({ message: "Champs obligatoires manquants" });
    }

    // 4. Récupérer le chemin du fichier uploadé (si présent)
    const documentPath = req.file ? req.file.path : null;

    // 5. Créer la consultation
    const newConsultation = await prisma.consultation.create({
      data: {
        motifConsultation,
        notes,
        prescription,
        date: new Date(),
        doctorEmail,
        AntecedentsMedicaux,
        symptomesObservees: symptomesObservees ? JSON.parse(symptomesObservees) : [],
        ExamenComplementairesDemandes,
        prochainRdv: prochainRdv ? new Date(prochainRdv) : null,
        Diagnostic,
        document: documentPath,
        dossier: { connect: { id: dossierId } },
        personnel: { connect: { email: personnelEmail } },
        patient: { connect: { email: patientEmail } },
      },
    });

    res.status(201).json(newConsultation);
  } catch (error) {
    console.error("Error creating consultation:", error);
    res.status(500).json({ message: "Failed to create consultation", error: error.message });
  }
};



export const getDossierConsultations = async (req, res) => {
  try {
    const { dossierId } = req.params;
    const consultations = await prisma.consultation.findMany({
      where: { dossierId },
      orderBy: { date: 'desc' },
      include: {
        personnel: {
          select: {
            nom: true,
            prenom: true,
            specialiteMedical: true
          }
        }
      }
    });
    res.status(200).json(consultations);
  } catch (error) {
    console.error('Error fetching consultations:', error);
    res.status(500).json({ message: 'Failed to get consultations' });
  }
};

export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        prenom: true,
        numeroDeTelephone: true,
        email: true
      }
    });
    
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    
    res.status(200).json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ message: 'Failed to get patient' });
  }
};
export const getRendezVousByPersonnel = async (req, res) => {
  try {
    const personnelId = req.user.id;

    const personnel = await prisma.personnnelDeSante.findUnique({
      where: { id: personnelId },
      select: { email: true },
    });

    if (!personnel) {
      return res.status(404).json({ message: "Personnel non trouvé" });
    }

    const personnelEmail = personnel.email;

    const rendezVousList = await prisma.rendezVous.findMany({
      where: { personnelEmail },
      orderBy: { dateHeure: "desc" },
      select: {
        id: true,
        patientEmail: true,
        dateHeure: true,
        statut: true,
        typeDeVisite: true,
        remarks: true,
        patient: {
          select: {
            numeroDeTelephone: true,
          },
        },
      },
    });

    const formattedList = rendezVousList.map((rdv) => ({
      id: rdv.id,
      patientEmail: rdv.patientEmail,
      dateHeure: rdv.dateHeure,
      statut: rdv.statut,
      typeDeVisite: rdv.typeDeVisite,
      remarks: rdv.remarks,
      patientPhone: rdv.patient?.numeroDeTelephone || "",
    }));

    res.json(formattedList);
  } catch (error) {
    console.error("Erreur récupération rendez-vous :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const updateRendezVousStatut = async (req, res) => {
  try {
    const { id } = req.params; // id du rendez-vous
    const { statut } = req.body; // nouveau statut : "CONFIRMED", "CANCELED" ou "COMPLETED"

    if (!["CONFIRMED", "CANCELED", "COMPLETED"].includes(statut)) {
      return res.status(400).json({ message: "Statut invalide" });
    }

    // Récupérer le rendez-vous
    const rdv = await prisma.rendezVous.findUnique({
      where: { id },
      select: { statut: true },
    });

    if (!rdv) {
      return res.status(404).json({ message: "Rendez-vous non trouvé" });
    }

    if (rdv.statut === "COMPLETED") {
      return res.status(400).json({ message: "Impossible de modifier un rendez-vous déjà complété" });
    }

    // Mettre à jour le statut
    const updatedRdv = await prisma.rendezVous.update({
      where: { id },
      data: { statut },
    });

    res.json(updatedRdv);
  } catch (error) {
    console.error("Erreur mise à jour statut rendez-vous:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
}


export const updatePatientProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const { civilite, numeroDeTelephone, email } = req.body;
    const avatarFile = req.file;

    // Validation simple
    if (civilite && !["masculin", "feminin"].includes(civilite)) {
      return res.status(400).json({ message: "Civilité invalide" });
    }

    // Préparer les données à mettre à jour
    const dataToUpdate = {};
    if (civilite) dataToUpdate.civilite = civilite;
    if (numeroDeTelephone) dataToUpdate.numeroDeTelephone = numeroDeTelephone;
    if (email) dataToUpdate.email = email;
    if (avatarFile) dataToUpdate.avatar = `/uploads/${avatarFile.filename}`;

    // Mettre à jour le patient
    const updatedPatient = await prisma.patient.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    res.status(200).json({ message: "Profil mis à jour avec succès", updatedPatient });
  } catch (error) {
    console.error("Erreur updateUserProfile:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
}


export const addKidToPatient = async (req, res) => {
  try {
    const patientId = req.params.id;
    const { firstName, lastName, birthDate } = req.body;

    if (!firstName || !lastName || !birthDate) {
      return res.status(400).json({ message: "Tous les champs sont obligatoires" });
    }

    const birth = new Date(birthDate);
    const ageMs = Date.now() - birth.getTime();
    const age = new Date(ageMs).getUTCFullYear() - 1970;
    if (age >= 18) {
      return res.status(400).json({ message: "L'enfant doit avoir moins de 18 ans" });
    }

    // Vérifier que le patient existe
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ message: "Patient non trouvé" });
    }

    // Créer l'enfant lié au patient
    const kid = await prisma.kid.create({
      data: {
        firstName,
        lastName,
        birthDate: birth,
        patient: { connect: { id: patientId } },
      },
    });

    res.status(201).json({ message: "Enfant ajouté avec succès", kid });
  } catch (error) {
    console.error("Erreur ajout enfant :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
}

export const getPatientRendezVousById = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Récupérer l'email du patient via son id
    const patient = await prisma.patient.findUnique({
      where: { id },
      select: { email: true },
    });

    if (!patient) {
      return res.status(404).json({ message: "Patient non trouvé" });
    }

    // 2. Récupérer les rendez-vous via l'email
    const rendezVous = await prisma.rendezVous.findMany({
      where: { patientEmail: patient.email },
      orderBy: { dateHeure: "asc" },
      include: {
        personnel: {
          select: {
            nom: true,
            prenom: true,
            specialiteMedical: true,
          },
        },
      },
    });

    res.status(200).json(rendezVous);
  } catch (error) {
    console.error("Erreur récupération rendez-vous :", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
