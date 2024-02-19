try 
{
  const {appointmentDate,employeeId} = req.body;
  const checkIfItsValidDate = () => {
    return !isNaN(new Date(appointmentDate));
  }
  console.log(checkIfItsValidDate);
} catch (error) {
  console.log(error)    
}