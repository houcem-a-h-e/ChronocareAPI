import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";



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


// Backend Controller
export const addChatMessage = async (req, res) => {
  const { language, message } = req.body;

  const qna = {
    fr: [
      { pattern: /comment.*va/i, response: "Je suis fantastique" },
      { pattern: /créer.*compte/i, response: "Vous pouvez créer un compte en entrant votre numéro national et en fournissant une pièce d'identité. Rendez-vous sur la page d'inscription et suivez les instructions." },
      { pattern: /historique.*médical/i, response: "Vous pouvez consulter votre historique médical en vous connectant à votre compte, puis en accédant à la section 'Historique médical'." },
      { pattern: /télécharger.*ordonnances/i, response: "Oui, vous pouvez télécharger vos ordonnances au format PDF depuis la section 'Ordonnances' de votre compte." },
      { pattern: /qui.*accéder.*dossier/i, response: "Seulement vous, votre médecin traitant et certains spécialistes autorisés peuvent accéder à votre dossier médical." },
      { pattern: /modifier.*informations/i, response: "Vous pouvez modifier vos informations personnelles en allant dans 'Paramètres', puis en sélectionnant 'Modifier les informations personnelles'. Vous devrez peut-être fournir des documents justificatifs pour certaines modifications." },
      { pattern: /oublie.*mot de passe/i, response: "Cliquez sur 'Mot de passe oublié' sur la page de connexion et suivez les instructions pour le réinitialiser." },
      { pattern: /ajouter.*ordonnance/i, response: "Votre médecin peut ajouter de nouvelles ordonnances directement à votre dossier via la plateforme ChronoCare." },
      { pattern: /données.*sécurisées/i, response: "Oui, ChronoCare utilise un chiffrement avancé et respecte les lois de protection des données comme le GDPR." },
      { pattern: /partager.*dossier/i, response: "Oui, vous pouvez créer un lien sécurisé qui donne au médecin un accès temporaire à votre dossier." },
      { pattern: /supprimer.*compte/i, response: "Vous pouvez demander la suppression de votre compte en allant dans 'Paramètres', puis en cliquant sur 'Supprimer le compte'." }
    ],
    ar: [
      { pattern: /كيف.*حالك/i, response: "أنا رائع" },
      { pattern: /إنشاء.*حساب/i, response: "يمكنك إنشاء حساب بإدخال رقم هويتك الوطنية وتقديم إثبات هوية. انتقل إلى صفحة التسجيل واتبع التعليمات." },
      { pattern: /تاريخي.*طبي/i, response: "يمكنك مشاهدة تاريخك الطبي عن طريق تسجيل الدخول إلى حسابك، ثم الانتقال إلى قسم 'التاريخ الطبي'." },
      { pattern: /تحميل.*وصفات/i, response: "نعم، يمكنك تنزيل وصفاتك الطبية بصيغة PDF من قسم 'الوصفات الطبية' في حسابك." },
      { pattern: /من.*يمكنه.*الوصول/i, response: "فقط أنت، وطبيبك المعالج، وبعض المتخصصين المصرح لهم يمكنهم الوصول إلى ملفك الطبي." },
      { pattern: /تعديل.*بيانات/i, response: "يمكنك تعديل بياناتك من خلال الذهاب إلى 'الإعدادات' ثم اختيار 'تعديل المعلومات الشخصية'. قد تحتاج إلى تقديم وثائق داعمة لبعض التعديلات." },
      { pattern: /نسيت.*كلمة.*المرور/i, response: "اضغط على 'نسيت كلمة المرور' في صفحة تسجيل الدخول واتبع التعليمات لإعادة تعيينها." },
      { pattern: /إضافة.*وصفة/i, response: "يمكن لطبيبك إضافة وصفات طبية جديدة مباشرة إلى ملفك عبر منصة ChronoCare." },
      { pattern: /بياناتي.*آمنة/i, response: "نعم، تستخدم ChronoCare تشفيرًا متقدمًا وتلتزم بقوانين حماية البيانات مثل GDPR." },
      { pattern: /مشاركة.*ملفي/i, response: "نعم، يمكنك إنشاء رابط آمن يمنح الطبيب الآخر حق الوصول المؤقت إلى ملفك." },
      { pattern: /حذف.*حساب/i, response: "يمكنك طلب حذف حسابك من خلال الانتقال إلى 'الإعدادات' ثم الضغط على 'حذف الحساب'." }
    ]
  };

  try {
    const langQna = qna[language] || [];
    const matched = langQna.find(q => q.pattern.test(message));
    
    if (matched) {
      return res.json({
        response: matched.response,
        language: language
      });
    }
    
    return res.status(400).json({ error: 'Question non reconnue' });
    
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
