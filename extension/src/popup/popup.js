import { generateStudyPlan } from '../utils/api.js'

document.addEventListener('DOMContentLoaded', () => {
	const testBtn = document.createElement('button');
	testBtn.textContent = 'Test API';
	document.body.appendChild(testBtn);

	testBtn.addEventListener('click', async () => {
		console.log('Generating Study Plan...');
		const studyPlan = await generateStudyPlan('SYS-701');
		alert(studyPlan || 'Failed')
	})
})