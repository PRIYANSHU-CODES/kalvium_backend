require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000;
const dbUrl = process.env.dburl;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true });

const OperationSchema = new mongoose.Schema({
    question: String,
    answer: Number
});

const Operation = mongoose.model('Operation', OperationSchema);

app.get('/', (req, res) => {
    res.send(`
        <h2>Sample Endpoints:</h2>
        <ul>
            <li>/5/plus/3</li>
            <li>/3/minus/5</li>
            <li>/3/minus/5/plus/8</li>
            
        </ul>
    `);
});

app.get('/history', async (req, res) => {
    try {
        let operations = await Operation.find().limit(20).sort({ _id: -1 });
        let historyHtml = operations.map(op => `<li>${op.question} = ${op.answer}</li>`).join('');
        res.send(`
            <h2>Last 20 operations:</h2>
            <ul>
                ${historyHtml}
            </ul>
        `);
    } catch (error) {
        res.status(500).send('Error retrieving operations.');
    }
});



app.get('/*', async (req, res) => {
    const mathParts = req.path.slice(1).split('/');

    if (mathParts.length % 2 === 0) {
        return res.status(400).send({ error: 'Invalid operation format' });
    }

    let question = mathParts[0];
    let values = [parseInt(mathParts[0], 10)];

    for (let i = 1; i < mathParts.length; i += 2) {
        const operator = mathParts[i];
        const operand = parseInt(mathParts[i + 1], 10);

        question += operatorSymbol(operator) + mathParts[i + 1];
        values.push(operator);
        values.push(operand);
    }

    for (let i = 0; i < values.length; i++) {
        if (typeof values[i] === 'string' && (values[i] === 'multiply' || values[i] === 'divide')) {
            if (values[i] === 'multiply') {
                values[i - 1] *= values[i + 1];
            } else {
                if (values[i + 1] === 0) return res.status(400).send({ error: 'Division by zero is not allowed' });
                values[i - 1] /= values[i + 1];
            }
            values.splice(i, 2);  
            i--;  
        }
    }

    let result = values[0];
    for (let i = 1; i < values.length; i += 2) {
        if (values[i] === 'plus') {
            result += values[i + 1];
        } else if (values[i] === 'minus') {
            result -= values[i + 1];
        }
    }

    try {
        const operation = new Operation({ question, answer: result });
        await operation.save();

        const operationsCount = await Operation.countDocuments();
        if (operationsCount > 20) {
            const operations = await Operation.find().sort({ _id: 1 }).limit(operationsCount - 20);
            for (let op of operations) {
                await op.remove();
            }
        }

        res.json({ question, answer: result });
    } catch (error) {
        res.status(500).send('Error saving operation.');
    }
});

function operatorSymbol(operator) {
    switch (operator) {
        case 'plus': return '+';
        case 'minus': return '-';
        case 'multiply': return '*';
        case 'divide': return '/';
        default: return '';
    }
}

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
