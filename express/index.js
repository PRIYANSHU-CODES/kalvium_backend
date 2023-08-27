require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const SERVER_PORT = 3000;
const DB_URL = process.env.dburl;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true });

const CalculationSchema = new mongoose.Schema({
    expression: String,
    result: Number
});

const Calculation = mongoose.model('Calculation', CalculationSchema);

app.get('/', (req, res) => {
    res.send(`
        <h2>Sample Input: /5/plus/3</h2>
    `);
});

app.get('/history', async (req, res) => {
    try {
        let calculations = await Calculation.find().limit(20).sort({ _id: -1 });
        let historyHtml = calculations.map(calc => `<li>${calc.expression} = ${calc.result}</li>`).join('');
        res.send(`
            <h2>Last 20 calculations:</h2>
            <ul>
                ${historyHtml}
            </ul>
        `);
    } catch (error) {
        res.status(500).send('Error retrieving calculations.');
    }
});

app.get('/*', async (req, res) => {
    const mathParts = req.path.slice(1).split('/');

    if (mathParts.length % 2 === 0) {
        return res.status(400).send({ error: 'Invalid calculation format' });
    }

    let expression = mathParts[0];
    let values = [parseInt(mathParts[0], 10)];

    for (let i = 1; i < mathParts.length; i += 2) {
        const operator = mathParts[i];
        const operand = parseInt(mathParts[i + 1], 10);

        expression += operatorSymbol(operator) + mathParts[i + 1];
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
        const calculation = new Calculation({ expression, result });
        await calculation.save();

        const calculationsCount = await Calculation.countDocuments();
        if (calculationsCount > 20) {
            const calculations = await Calculation.find().sort({ _id: 1 }).limit(calculationsCount - 20);
            for (let calc of calculations) {
                await calc.remove();
            }
        }

        res.json({ expression, result });
    } catch (error) {
        res.status(500).send('Error saving calculation.');
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

app.listen(SERVER_PORT, () => {
    console.log(`Server is running at http://localhost:${SERVER_PORT}`);
});
