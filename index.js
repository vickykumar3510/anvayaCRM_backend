const express = require('express');
const cors = require('cors')
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config();

const app = express();

const { initializeDatabase } = require('./db/db.connect');
const Lead = require('./models/leadModel.models');
const SalesAgent = require('./models/salesAgent.models');
const Comment = require('./models/comment.models')
const User = require('./models/user.models')

app.use(cors())
app.use(express.json());
initializeDatabase();

const JWT_SECRET = process.env.JWT_SECRET

//delete after use//
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Root from Express' });
});

//1. Add Sales agent - IT IS WORKING

app.post('/agents', async (req, res) => {
    try {
        const newAgent = new SalesAgent(req.body);

        if (!newAgent.name) {
            return res.status(400).json({ error: "'name' is required." });
        }
        if (!newAgent.email) {
            return res.status(400).json({ error: "'email' is required." });
        }

        await newAgent.save();
        
        res.status(201).json({
            message: "Sales agent added.",
            agent: newAgent
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to add sales agent.", details: error.message });
    }
});


// 2. Create Lead - need to check code updated
app.post('/leads', async (req, res) => {
    try {
        const newLead = new Lead(req.body);

        // Required fields validation
        if (!newLead.name) return res.status(400).json({ error: "'name' is required." });
        if (!newLead.source) return res.status(400).json({ error: "'source' is required." });
        if (!newLead.salesAgent || newLead.salesAgent.length === 0)
            return res.status(400).json({ error: "'salesAgent' is required." });
        if (!newLead.status) return res.status(400).json({ error: "'status' is required." });
        if (!newLead.tags || newLead.tags.length === 0) return res.status(400).json({ error: "'tags' is required." });
        if (!newLead.timeToClose) return res.status(400).json({ error: "'timeToClose' is required." });
        if (!newLead.priority) return res.status(400).json({ error: "'priority' is required." });

        // Validate each salesAgent ID
        for (let id of newLead.salesAgent) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ error: `Invalid salesAgent ID: ${id}` });
            }
            const agentExists = await SalesAgent.findById(id);
            if (!agentExists) {
                return res.status(404).json({ error: `Sales agent with ID '${id}' not found.` });
            }
        }

        // Save the new lead
        await newLead.save();

        res.status(201).json({
            message: "Lead created.",
            lead: newLead
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to add lead.", details: error.message });
    }
});


//3. Read all leads - IT IS WORKING

app.get("/leads", async (req, res) => {
    try {
        const leads = await Lead.find()
        .populate("salesAgent")
        if (leads.length !== 0) {
            res.json(leads);
        } else {
            res.status(404).json({ error: "No leads found." });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch leads.", details: error.message });
    }
});

//4. Update lead by id - it is working

async function updateLead(id, dataToUpdate) {
    try {
        const updatedLead = await Lead.findByIdAndUpdate(
            id,
            dataToUpdate,
            { new: true, runValidators: true }
        ).populate("salesAgent", "name");

        return updatedLead;
    } catch (error) {
        throw error;
    }
}

app.put('/leads/:id', async (req, res) => {
    try {
        const leadId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(leadId)) {
            return res.status(400).json({ error: "Invalid Lead ID format." });
        }

        const {
            name,
            source,
            salesAgent,
            status,
            tags,
            timeToClose,
            priority
        } = req.body;

        if (!name) return res.status(400).json({ error: "'name' is required." });
        if (!source) return res.status(400).json({ error: "'source' is required." });
        if (!salesAgent) return res.status(400).json({ error: "'salesAgent' is required." });
        if (!status) return res.status(400).json({ error: "'status' is required." });
        if (!tags) return res.status(400).json({ error: "'tags' is required." });
        if (!timeToClose) return res.status(400).json({ error: "'timeToClose' is required." });
        if (!priority) return res.status(400).json({ error: "'priority' is required." });

        if (!mongoose.Types.ObjectId.isValid(salesAgent)) {
            return res.status(400).json({ error: "Invalid 'salesAgent' ID format." });
        }

        const agentExists = await SalesAgent.findById(salesAgent);
        if (!agentExists) {
            return res.status(404).json({ error: `Sales agent with ID '${salesAgent}' not found.` });
        }

        const bodyWithUpdatedAt = {
            ...req.body,
            updatedAt: Date.now()
        };

        const updatedLead = await updateLead(leadId, bodyWithUpdatedAt);

        if (!updatedLead) {
            return res.status(404).json({
                error: `Lead with ID '${leadId}' not found.`
            });
        }

        res.status(200).json({
            message: "Lead updated successfully.",
            lead: {
                id: updatedLead._id,
                name: updatedLead.name,
                source: updatedLead.source,
                salesAgent: {
                    id: updatedLead.salesAgent?._id,
                    name: updatedLead.salesAgent?.name
                },
                status: updatedLead.status,
                tags: updatedLead.tags,
                timeToClose: updatedLead.timeToClose,
                priority: updatedLead.priority,
                updatedAt: updatedLead.updatedAt
            }
        });

    } catch (error) {
        res.status(500).json({
            error: "Failed to update Lead.",
            details: error.message
        });
    }
});


//5. Delete a lead - it is working

async function deleteLead(id){
    try{
        const deletedLead = await Lead.findByIdAndDelete(id)
        return deletedLead
    }catch(error){
        throw error
    }
}

app.delete('/leads/:id', async(req, res) => {
    try{
        const deletedLead = await deleteLead(req.params.id)
        if(deletedLead){
            res.status(200).json({message: "Lead deleted successfully."})
        } else{
            res.status(404).json({error: `Lead with ID ${req.params.id} not found.`})
        }

    }catch(error){
        res.status(500).json({error: "Failed to delete a lead.", details: error.message})
    }
})

//6. Read all sales agent - IT IS WORKING

app.get("/agents", async (req, res) => {
    try {
        const agents = await SalesAgent.find();
        if (agents.length !== 0) {
            res.json(agents);
        } else {
            res.status(404).json({ error: "No agents found." });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch agents.", details: error.message });
    }
});

//7. Add comment to a Lead - it is working

app.post('/leads/:id/comments', async (req, res) => {
    try {
        const leadId = req.params.id;
        const { commentText, author } = req.body; 

        if (!commentText || typeof commentText !== "string") {
            return res.status(400).json({ error: "commentText is required and must be a string" });
        }

        const lead = await Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({ error: `Lead with ID '${leadId}' not found.` });
        }

        const comment = new Comment({
            lead: leadId,
            author,
            commentText
        });

        await comment.save();

        const populatedComment = await Comment.findById(comment._id)
            .populate("author", "name");

        res.status(201).json({
            id: populatedComment._id,
            commentText: populatedComment.commentText,
            author: populatedComment.author.name,
            createdAt: populatedComment.createdAt
        });

    } catch (error) {
        res.status(500).json({ error: "Failed to add comment", details: error.message });
    }
});

//8. All comments of a lead - it is working

app.get('/leads/:id/comments', async (req, res) => {
    try {
        const leadId = req.params.id;

        const leadExists = await Lead.findById(leadId);
        if (!leadExists) {
            return res.status(404).json({
                error: `Lead with ID '${leadId}' not found.`
            });
        }

        const comments = await Comment.find({ lead: leadId })
            .populate("author", "name") 
            .sort({ createdAt: 1 });     // oldest first, then newest

        const response = comments.map(cmnt => ({
            id: cmnt._id,
            commentText: cmnt.commentText,
            author: cmnt.author?.name || "Unknown",
            createdAt: cmnt.createdAt
        }));

        res.status(200).json(response);

    } catch (error) {
        res.status(500).json({
            error: "Failed to get comments",
            details: error.message
        });
    }
});

//9. all leads that were closed in last 7 days -  it is working

app.get("/report/last-week", async (req, res) => {
    try {
    
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);

        const closedLeads = await Lead.find({
            status: "Closed",
            updatedAt: { $gte: lastWeek }
        }).populate("salesAgent", "name");

        if (closedLeads.length === 0) {
            return res.status(404).json({ error: "No leads closed in the last 7 days." });
        }

        const response = closedLeads.map(lead => ({
            id: lead._id,
            name: lead.name,
            salesAgent: lead.salesAgent?.name || "Unknown",
            closedAt: lead.updatedAt
        }));

        res.status(200).json(response);

    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch last week's closed leads.",
            details: error.message
        });
    }
});

//10. total leads in pipeline - it is working
app.get("/report/pipeline", async (req, res) => {
  try {
    const pipeline = await Lead.countDocuments({ status: { $ne: "Closed" } });
    const closed = await Lead.countDocuments({ status: "Closed" });

    res.status(200).json({
      totalLeadsInPipeline: pipeline,
      totalLeadsClosed: closed,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch pipeline report.",
      details: error.message,
    });
  }
});



//11. Delete agent - it is working

async function deleteAgent(id){
    try{
        const deletedAgent = await SalesAgent.findByIdAndDelete(id)
        return deletedAgent
    }catch(error){
        throw error
    }
}

app.delete('/agents/:id', async(req, res) => {
    try{
        const deletedAgent = await deleteAgent(req.params.id)
        if(deletedAgent){
            res.status(200).json({message: "Agent deleted successfully."})
        } else{
            res.status(404).json({error: `Agent with ID ${req.params.id} not found.`})
        }

    }catch(error){
        res.status(500).json({error: "Failed to delete an Agent.", details: error.message})
    }
})

//12. Delete all comments

app.delete('/comments', async (req, res) => {
    try {
        const result = await Comment.deleteMany({});
        res.status(200).json({
            message: "All comments deleted successfully.",
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to delete all comments",
            details: error.message
        });
    }
});

// 13. leads closed by sales agent
app.get("/report/agent-closures", async (req, res) => {
  try {
    const result = await Lead.aggregate([
      { $match: { status: "Closed" } },
      {
        $group: {
          _id: "$salesAgent",        // group by salesAgent field
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      {
        $lookup: {
          from: "salesagents",      
          localField: "_id",
          foreignField: "_id",
          as: "agent",
        },
      },
      { $unwind: "$agent" },
      {
        $project: {
          _id: 0,
          name: "$agent.name",
          count: 1,
        },
      },
    ]);

    const labels = result.map((r) => r.name);
    const counts = result.map((r) => r.count);

    res.json({ labels, counts });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch agent closures",
      details: err.message,
    });
  }
});

// 14. Lead status distribution
app.get("/report/status-distribution", async (req, res) => {
  try {
    const result = await Lead.aggregate([
      {
        $group: {
          _id: "$status",     // group by status field
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const labels = result.map((r) => r._id);    // e.g. ["New","In Progress","Closed"]
    const counts = result.map((r) => r.count);  // e.g. [5,3,2]

    res.json({ labels, counts });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch status distribution",
      details: err.message,
    });
  }
});

////////
//JWT middleware

const verifyJWT = (req, res, next) => {
    const token = req.headers['authorization']
    if(!token){
        return res.status(401).json({ message: "No token provided." })
    }

    try{
        const decodedToken = jwt.verify(token, JWT_SECRET)
        req.user = decodedToken
        next()
    }catch(error){
        return res.status(401).json({message: "Invalid token."})
    }
}

//auth route for sign up

app.post('/auth/signup', async(req, res) => {
    try{
        const { name, email, password } = req.body
        if(!name || !email || !password){
            return res.status(400).json({error: "All fields are required."})
        }

        const normalizedEmail = email.trim().toLowerCase()
        const existingUser = await User.findOne({ email: normalizedEmail })

        if(existingUser){
            return res.status(409).json({error: "email already registered."})
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        
        const newUser = new User({
            name,
            email: normalizedEmail,
            password: hashedPassword
        })

        await newUser.save()
        res.status(201).json({message: "User registered successfully."})

    }catch(error){
        if(error.code === 11000){
            return res.status(409).json({error: "email already registered."})
        }
        res.status(500).json({error: "Signup failed", details: error.message})
    }
})

//auth route for log in

app.post('/auth/login', async (req, res) => {
    try{
        const {email, password} = req.body
        if(!email || !password){
            return res.status(400).json({error: "email and password required."})
        }

        const normalizedEmail = email.trim().toLowerCase()
        const user = await User.findOne({ email: normalizedEmail }).select('+password')
        if(!user) return res.status(401).json({error: "Invalid credentials."})

        const isMatch = await bcrypt.compare(password, user.password)
        if(!isMatch) return res.status(401).json({error: "Invalid credentials"})
        
        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, {expiresIn: '24h'})

        res.json({message: "Login successfully", token})

    }catch(error){
        res.status(500).json({error: "Login failed", details: error.message})
    }
})

//get authenticate user details

app.get('/auth/me', verifyJWT, async(req, res) => {
    try{
        const user = await User.findById(req.user.userId).select('-password')
        if(!user) return res.status(404).json({error: "user not found."})
        res.json({user})
    }catch(error){
        res.status(500).json({error: "Failed to fetch user", details:  error.message})
    }
})

//list of all user(owners)

app.get('/users', async(req, res) => {
    try{
        const users = await User.find().select('-password')
        if(users !== 0){
            res.json(users)
        }else{
            res.status(404).json({error: "no users found."})
        }

    }catch(error){
        res.status(500).json({error: "Failed to fetch users", details: error.message})
    }
})

 //delete user by id
async function deleteUser(id){
    try{
        const deletedUser = await User.findByIdAndDelete(id)
        return deletedUser
    }catch(error){
        throw error
    }
}

app.delete('/users/:id', async(req, res) => {
    try{
        const deletedUser = await deleteUser(req.params.id)
        if(deletedUser){
            res.status(200).json({message: "User deleted successfully."})
        }else{
            res.status(404).json({error: "User not found."})
        }

    }catch(error){
        res.status(500).json({error: "Failed to delete user", details: error.message})
    }
})

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Local dev: only listen when running directly (NOT on Vercel)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Vercel: export app as handler
module.exports = app;