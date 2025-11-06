const Project = require("../Modals/Project");

exports.createProject = async (req, res) => {
  try {
    const project = await Project.create(req.body);
    res
      .status(201)
      .json({ success: true, message: "Project created", data: project });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error creating project",
        error: err.message,
      });
  }
};

exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate("assignedEmployees", "name email")
      .populate("tasks.assignedTo", "name email")
      .populate("tasks.comments.commentedBy", "name")
      .populate("tasks.timeLogs.employeeId", "name");

    res.json({ success: true, data: projects });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching projects",
        error: err.message,
      });
  }
};

exports.addTaskToProject = async (req, res) => {
  const { id } = req.params;
  const { title, description, assignedTo, dueDate } = req.body;

  try {
    const project = await Project.findById(id);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const assignedArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];

    const newTask = {
      title,
      description,
      assignedTo: assignedArray,
      dueDate,
      status: "pending",
      comments: [],
      timeLogs: [],
    };

    project.tasks.push(newTask);
    await project.save();

    res.status(201).json({
      success: true,
      message: "Task added successfully",
      data: project.tasks[project.tasks.length - 1],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding task",
      error: error.message,
    });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("assignedEmployees", "name email")
      .populate("tasks.assignedTo", "name email")
      .populate("tasks.comments.commentedBy", "name")
      .populate("tasks.timeLogs.employeeId", "name");

    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    res.json({ success: true, data: project });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error fetching project",
        error: err.message,
      });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ success: true, message: "Project updated", data: project });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error updating project",
        error: err.message,
      });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Project deleted" });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error deleting project",
        error: err.message,
      });
  }
};

exports.deleteTaskFromProject = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const taskIndex = project.tasks.findIndex(
      (task) => task._id.toString() === taskId
    );
    if (taskIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found in this project" });
    }

    project.tasks.splice(taskIndex, 1);

    await project.save();

    res.json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting task",
      error: error.message,
    });
  }
};

exports.updateTaskStatus = async (req, res) => {
  const { projectId, taskId } = req.params;
  const { status } = req.body;

  try {
    const project = await Project.findById(projectId);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    const task = project.tasks.id(taskId);
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });

    task.status = status;
    await project.save();

    res.json({ success: true, message: "Task status updated", data: task });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error updating task status",
        error: err.message,
      });
  }
};

exports.addCommentToTask = async (req, res) => {
  const { projectId, taskId } = req.params;
  const { commentText, commentedBy } = req.body;

  try {
    const project = await Project.findById(projectId);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    const task = project.tasks.id(taskId);
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });

    task.comments.push({ commentText, commentedBy, commentedAt: new Date() });
    await project.save();

    const updated = await Project.findById(projectId).populate(
      "tasks.comments.commentedBy",
      "name"
    );

    const updatedTask = updated.tasks.id(taskId);

    res.json({
      success: true,
      message: "Comment added",
      data: updatedTask.comments,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error adding comment",
      error: err.message,
    });
  }
};

exports.addTimeLogToTask = async (req, res) => {
  const { projectId, taskId } = req.params;
  const { employeeId, hours } = req.body;

  try {
    const project = await Project.findById(projectId);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    const task = project.tasks.id(taskId);
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });

    task.timeLogs.push({ employeeId, hours, logDate: new Date() });
    await project.save();

    res.json({ success: true, message: "Time log added", data: task.timeLogs });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Error adding time log",
        error: err.message,
      });
  }
};
