const express = require("express");
const router = express.Router();
const verifyToken = require("../Middleware/auth");
const projectController = require("../Controllers/projectController");

router.post("/projects", verifyToken, projectController.createProject);
router.get("/", verifyToken, projectController.getAllProjects);
router.get("/:id", verifyToken, projectController.getProjectById);
router.put("/:id", verifyToken, projectController.updateProject);
router.delete("/:id", verifyToken, projectController.deleteProject);

router.post("/:id/tasks", verifyToken, projectController.addTaskToProject);
router.delete(
  "/:projectId/tasks/:taskId",
  verifyToken,
  projectController.deleteTaskFromProject
);
router.put(
  "/:projectId/tasks/:taskId/status",
  verifyToken,
  projectController.updateTaskStatus
);
router.post(
  "/:projectId/tasks/:taskId/comments",
  verifyToken,
  projectController.addCommentToTask
);
router.post(
  "/:projectId/tasks/:taskId/timelogs",
  verifyToken,
  projectController.addTimeLogToTask
);

module.exports = router;
